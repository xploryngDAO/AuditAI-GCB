// Cofre local criptografado (AES-256-GCM + scrypt) para artefatos sensíveis.
// Uso:
//   $env:VAULT_PASSPHRASE="..."; node scripts/vault.mjs create
//   $env:VAULT_PASSPHRASE="..."; node scripts/vault.mjs open --vault <arquivo> --out <diretorio>
//   node scripts/vault.mjs list
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const VAULT_DIR = 'vault';
const MAGIC = Buffer.from('AIVLT1\n', 'utf8');
const cmd = process.argv[2];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function sensitiveFiles() {
  const files = new Set(['.env']);
  const add = (p) => { if (fs.existsSync(p) && fs.statSync(p).isFile()) files.add(p.replace(/\\/g, '/')); };
  const addDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) addDir(full); else add(full);
    }
  };
  if (fs.existsSync('.scratch/backups')) {
    for (const entry of fs.readdirSync('.scratch/backups', { withFileTypes: true })) {
      const full = path.join('.scratch/backups', entry.name);
      if (entry.isDirectory()) addDir(full); else add(full);
    }
  }
  for (const name of fs.readdirSync('.scratch')) {
    if (!fs.statSync(path.join('.scratch', name)).isFile()) continue;
    if (/^(prod-cleanup-(applied|target|report)|prod-superadmin-rotation|prod-post-deploy-smoke)-/.test(name) ||
        ['reset-target.json', 'clear-methodology-target.json', 'stage3-dsn.txt'].includes(name)) {
      add(path.join('.scratch', name));
    }
  }
  return [...files];
}

function encrypt(plainBuf, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(vaultBuf, passphrase) {
  if (!vaultBuf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Formato de cofre inválido.');
  let off = MAGIC.length;
  const salt = vaultBuf.subarray(off, off += 16);
  const iv = vaultBuf.subarray(off, off += 12);
  const tag = vaultBuf.subarray(off, (off += 16) - 16 + 16);
  const ciphertext = vaultBuf.subarray(off);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

if (cmd === 'create') {
  const passphrase = process.env.VAULT_PASSPHRASE;
  if (!passphrase || passphrase.length < 20) { console.error('Defina VAULT_PASSPHRASE (20+ caracteres).'); process.exit(1); }
  const files = sensitiveFiles();
  const bundle = { createdAt: new Date().toISOString(), files: [] };
  for (const file of files) {
    const data = fs.readFileSync(file);
    bundle.files.push({ path: file, size: data.length, sha256: sha256(data), data: data.toString('base64') });
  }
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
  const vaultBuf = encrypt(plain, passphrase);
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const vaultPath = path.join(VAULT_DIR, `auditai-vault-${stamp}.aiv`);
  fs.writeFileSync(vaultPath, vaultBuf);
  const manifest = { createdAt: bundle.createdAt, vault: vaultPath, files: bundle.files.map(({ data, ...rest }) => rest) };
  const manifestPath = path.join(VAULT_DIR, `manifest-${stamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(JSON.stringify({ created: vaultPath, manifest: manifestPath, files: manifest.files.length, bytes: vaultBuf.length, sha256: sha256(vaultBuf) }, null, 2));
} else if (cmd === 'open') {
  const passphrase = process.env.VAULT_PASSPHRASE;
  if (!passphrase) { console.error('Defina VAULT_PASSPHRASE.'); process.exit(1); }
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const vaultPath = arg('--vault');
  const outDir = arg('--out');
  if (!vaultPath || !outDir) { console.error('Informe --vault e --out.'); process.exit(1); }
  const bundle = JSON.parse(zlib.gunzipSync(decrypt(fs.readFileSync(vaultPath), passphrase)).toString('utf8'));
  let ok = 0;
  for (const file of bundle.files) {
    const data = Buffer.from(file.data, 'base64');
    if (sha256(data) !== file.sha256) throw new Error(`Hash divergente: ${file.path}`);
    const target = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    ok += 1;
  }
  console.log(JSON.stringify({ restored: ok, outDir, capturedAt: bundle.createdAt }, null, 2));
} else if (cmd === 'list') {
  const dir = VAULT_DIR;
  if (!fs.existsSync(dir)) { console.log('Cofre vazio.'); process.exit(0); }
  for (const entry of fs.readdirSync(dir).filter((n) => n.startsWith('manifest-')).sort()) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
    console.log(JSON.stringify({ manifest: entry, createdAt: m.createdAt, files: m.files.length, entries: m.files.map((f) => `${f.path} (${f.size} B)`) }, null, 2));
  }
} else {
  console.error('Comandos: create | open --vault <arquivo> --out <dir> | list');
  process.exit(1);
}

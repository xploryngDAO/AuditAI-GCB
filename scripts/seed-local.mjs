#!/usr/bin/env node
/**
 * Seed do banco de dados local do AuditAI GCB.
 *
 * Garante, de forma idempotente, no arquivo `database_store.json` (a
 * persistência local usada quando nao existe DATABASE_URL):
 *
 *   - SaaS Master: marcel.andre@viavarejo.com.br / Mudar@123 (escopo global);
 *   - Tenant: "Grupo Casas Bahia" (id `grupo-casas-bahia`, ativo, plano enterprise);
 *   - Usuario principal da tenant: marcel.andre@casasbahia.com.br / Mudar@123.
 *
 * Uso:
 *   node scripts/seed-local.mjs                 # cria apenas o que falta
 *   node scripts/seed-local.mjs --check         # valida sem gravar (exit 1 se falhar)
 *   node scripts/seed-local.mjs --json          # saida JSON (automacao)
 *   node scripts/seed-local.mjs --reset-passwords
 *                                               # forca a senha Mudar@123 nas contas seed
 *   node scripts/seed-local.mjs --reset         # apaga o banco local e recria o seed
 *   node scripts/seed-local.mjs --file <caminho> (ou LOCAL_DB_FILE=...)
 *
 * O seed nunca sobrescreve dados existentes de tenant/usuarios alem do que foi
 * pedido acima; senhas existentes so mudam com --reset-passwords.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_TENANT_ID = 'system-global';
const TENANT_ID = 'grupo-casas-bahia';
const TENANT_NAME = 'Grupo Casas Bahia';
const MASTER_EMAIL = 'marcel.andre@viavarejo.com.br';
const TENANT_ADMIN_EMAIL = 'marcel.andre@casasbahia.com.br';
const PASSWORD = 'Mudar@123';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const asJson = Boolean(args.json);
const dbFile = resolve(
  typeof args.file === 'string' && args.file
    ? args.file
    : process.env.LOCAL_DB_FILE || resolve(ROOT, 'database_store.json')
);

function log(message) {
  if (!asJson) console.log(message);
}

function warn(message) {
  if (!asJson) console.warn(message);
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  // Mesmo formato e parametros do servidor (server.ts: hashPassword).
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function isValidPasswordHash(passwordHash) {
  // Formato gravado pelo servidor: scrypt$<salt hex 32>$<hash hex 128>.
  if (typeof passwordHash !== 'string' || !passwordHash.startsWith('scrypt$')) return false;
  const parts = passwordHash.split('$');
  return parts.length === 3 && /^[0-9a-f]{32}$/i.test(parts[1]) && /^[0-9a-f]{128}$/i.test(parts[2]);
}

function verifyPassword(password, passwordHash) {
  if (!isValidPasswordHash(passwordHash)) return false;
  const [, salt, stored] = passwordHash.split('$');
  try {
    const candidate = scryptSync(password, salt, 64).toString('hex');
    return stored.length === candidate.length && timingSafeEqual(Buffer.from(stored), Buffer.from(candidate));
  } catch {
    return false;
  }
}

function readState() {
  if (!existsSync(dbFile)) return null;
  // Tolera BOM (arquivo salvo por alguns editores do Windows).
  const raw = readFileSync(dbFile, 'utf8').replace(/^\uFEFF/, '');
  if (!raw.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Banco local invalido (${dbFile}): ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Banco local invalido (${dbFile}): esperado um objeto JSON na raiz.`);
  }
  return parsed;
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function findTenant(tenants) {
  return (
    tenants.find((tenant) => tenant && String(tenant.id) === TENANT_ID) ||
    tenants.find((tenant) => tenant && normalizeEmail(tenant.name) === normalizeEmail(TENANT_NAME)) ||
    tenants.find((tenant) => tenant && normalizeEmail(tenant.adminEmail) === TENANT_ADMIN_EMAIL) ||
    null
  );
}

function ensureSeed(state, options) {
  const now = new Date().toISOString();
  const changes = [];
  const warnings = [];

  if (!Array.isArray(state.usersDb)) {
    state.usersDb = [];
    changes.push('usersDb criado');
  }
  if (!Array.isArray(state.tenantsDb)) {
    state.tenantsDb = [];
    changes.push('tenantsDb criado');
  }
  const users = state.usersDb;
  const tenants = state.tenantsDb;

  let tenant = findTenant(tenants);
  if (!tenant) {
    tenant = {
      id: TENANT_ID,
      name: TENANT_NAME,
      slug: TENANT_ID,
      active: true,
      adminEmail: TENANT_ADMIN_EMAIL,
      createdAt: now,
      plan: 'enterprise'
    };
    tenants.push(tenant);
    changes.push(`tenant criado: ${TENANT_NAME} (${TENANT_ID})`);
  } else {
    if (!tenant.id) {
      tenant.id = TENANT_ID;
      changes.push('tenant.id definido');
    }
    if (tenant.name !== TENANT_NAME) {
      tenant.name = TENANT_NAME;
      changes.push('tenant.name atualizado');
    }
    if (normalizeEmail(tenant.adminEmail) !== TENANT_ADMIN_EMAIL) {
      tenant.adminEmail = TENANT_ADMIN_EMAIL;
      changes.push('tenant.adminEmail atualizado');
    }
    if (tenant.active !== true) {
      tenant.active = true;
      changes.push('tenant reativado');
    }
    if (!tenant.createdAt) {
      tenant.createdAt = now;
      changes.push('tenant.createdAt definido');
    }
    if (!tenant.slug) {
      tenant.slug = TENANT_ID;
      changes.push('tenant.slug definido');
    }
    if (tenant.plan !== 'enterprise') {
      tenant.plan = 'enterprise';
      changes.push('tenant.plan definido como enterprise');
    }
    // Remove duplicatas do mesmo tenant que possam ter sobrado de edicoes manuais.
    const duplicates = tenants.filter(
      (item) =>
        item !== tenant &&
        item &&
        (String(item.id) === String(tenant.id) ||
          normalizeEmail(item.name) === normalizeEmail(TENANT_NAME))
    );
    for (const duplicate of duplicates) {
      tenants.splice(tenants.indexOf(duplicate), 1);
      changes.push('tenant duplicado removido');
    }
  }

  const tenantId = String(tenant.id);

  const ensureUser = (spec) => {
    const email = normalizeEmail(spec.email);
    let user = users.find((item) => item && normalizeEmail(item.email) === email);
    const desired = { email, role: spec.role, tenantId: spec.tenantId, bpoName: null };

    if (!user) {
      users.push({ ...desired, passwordHash: hashPassword(PASSWORD) });
      changes.push(`usuario criado: ${email} (${spec.role})`);
      return;
    }

    if (normalizeEmail(user.email) !== email) {
      user.email = email;
      changes.push(`email normalizado: ${email}`);
    }
    if (!isValidPasswordHash(user.passwordHash)) {
      // Hash ausente/corrompido: sem ele a conta nao consegue autenticar, entao
      // o seed repara sempre (nao depende de --reset-passwords).
      user.passwordHash = hashPassword(PASSWORD);
      changes.push(`hash recriado: ${email}`);
    } else if (!verifyPassword(PASSWORD, user.passwordHash)) {
      if (options.resetPasswords) {
        user.passwordHash = hashPassword(PASSWORD);
        changes.push(`senha redefinida: ${email}`);
      } else {
        warnings.push(`a senha atual de ${email} nao e Mudar@123; use --reset-passwords para redefinir`);
      }
    }
    if (user.role !== desired.role) {
      user.role = desired.role;
      changes.push(`papel ajustado: ${email} -> ${desired.role}`);
    }
    if (String(user.tenantId ?? '') !== desired.tenantId) {
      user.tenantId = desired.tenantId;
      changes.push(`tenant ajustado: ${email} -> ${desired.tenantId}`);
    }
    if (user.bpoName !== null && user.bpoName !== undefined) {
      user.bpoName = null;
      changes.push(`bpoName limpo: ${email}`);
    }
  };

  ensureUser({ email: MASTER_EMAIL, role: 'superadmin', tenantId: GLOBAL_TENANT_ID });
  ensureUser({ email: TENANT_ADMIN_EMAIL, role: 'admin', tenantId });

  return { state, changes, warnings, tenantId };
}

function checkSeed(state) {
  const failures = [];
  const warnings = [];
  const users = Array.isArray(state?.usersDb) ? state.usersDb : [];
  const tenants = Array.isArray(state?.tenantsDb) ? state.tenantsDb : [];

  const tenant = findTenant(tenants);
  if (!tenant) {
    failures.push(`tenant "${TENANT_NAME}" nao encontrado`);
  } else {
    if (tenant.name !== TENANT_NAME) failures.push(`tenant.name diferente de "${TENANT_NAME}"`);
    if (normalizeEmail(tenant.adminEmail) !== TENANT_ADMIN_EMAIL) {
      failures.push(`tenant.adminEmail diferente de ${TENANT_ADMIN_EMAIL}`);
    }
    if (tenant.active !== true) failures.push('tenant inativo');
  }

  const checkUser = (email, role, tenantId) => {
    const user = users.find((item) => item && normalizeEmail(item.email) === normalizeEmail(email));
    if (!user) {
      failures.push(`usuario ${email} nao encontrado`);
      return;
    }
    if (user.role !== role) failures.push(`usuario ${email} com papel ${user.role} (esperado ${role})`);
    if (String(user.tenantId ?? '') !== tenantId) {
      failures.push(`usuario ${email} no tenant ${user.tenantId} (esperado ${tenantId})`);
    }
    if (!verifyPassword(PASSWORD, user.passwordHash)) {
      failures.push(`usuario ${email} sem a senha ${PASSWORD}`);
    }
  };

  checkUser(MASTER_EMAIL, 'superadmin', GLOBAL_TENANT_ID);
  checkUser(TENANT_ADMIN_EMAIL, 'admin', tenant ? String(tenant.id) : TENANT_ID);

  return { failures, warnings };
}

function printSummary(payload) {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Banco local : ${dbFile}`);
  if (payload.mode === 'check') {
    console.log(`Modo        : verificacao (sem gravar)`);
  } else if (payload.mode === 'seed') {
    console.log(`Modo        : seed`);
    if (payload.changes.length === 0) {
      console.log('Alteracoes  : nenhuma (seed ja estava completo)');
    } else {
      console.log('Alteracoes  :');
      for (const change of payload.changes) console.log(`  - ${change}`);
    }
  }
  for (const warning of payload.warnings) console.warn(`AVISO: ${warning}`);
  if (payload.failures.length === 0) {
    console.log('');
    console.log('OK: master, tenant e usuario principal conferem.');
    console.log(`  Master  : ${MASTER_EMAIL} / ${PASSWORD} (superadmin global)`);
    console.log(`  Tenant  : ${TENANT_NAME} (${payload.tenantId})`);
    console.log(`  Admin   : ${TENANT_ADMIN_EMAIL} / ${PASSWORD} (admin da tenant)`);
  } else {
    console.error('');
    console.error('FALHA: o banco local nao confere com o esperado:');
    for (const failure of payload.failures) console.error(`  - ${failure}`);
  }
}

function main() {
  if (args.check && args.reset) {
    console.error('Use --check ou --reset, nao os dois.');
    process.exit(2);
  }

  if (args.check) {
    const state = readState();
    if (!state) {
      console.error(`Banco local nao encontrado em ${dbFile}. Execute o seed (node scripts/seed-local.mjs).`);
      process.exit(1);
    }
    const result = checkSeed(state);
    const payload = {
      mode: 'check',
      file: dbFile,
      ok: result.failures.length === 0,
      changes: [],
      failures: result.failures,
      warnings: result.warnings,
      tenantId: findTenant(Array.isArray(state.tenantsDb) ? state.tenantsDb : [])?.id ?? null
    };
    printSummary(payload);
    process.exit(payload.ok ? 0 : 1);
  }

  if (args.reset) {
    if (existsSync(dbFile)) {
      rmSync(dbFile);
      log(`Banco local removido: ${dbFile}`);
    } else {
      log(`Banco local ja nao existia: ${dbFile}`);
    }
  }

  const state = readState() ?? {};
  const { changes, warnings } = ensureSeed(state, { resetPasswords: Boolean(args['reset-passwords']) });

  if (!existsSync(dbFile) || changes.length > 0) {
    writeFileSync(dbFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  const result = checkSeed(state);
  const payload = {
    mode: 'seed',
    file: dbFile,
    ok: result.failures.length === 0,
    changes,
    failures: result.failures,
    warnings: [...warnings, ...result.warnings],
    tenantId: findTenant(state.tenantsDb)?.id ?? null
  };
  printSummary(payload);
  process.exit(payload.ok ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

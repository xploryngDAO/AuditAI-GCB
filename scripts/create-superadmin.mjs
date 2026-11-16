#!/usr/bin/env node
/**
 * Provisiona o primeiro superadministrador do AuditaQA.
 *
 * Uso:
 *   node scripts/create-superadmin.mjs --check
 *   node scripts/create-superadmin.mjs --email voce@empresa.com
 *   node scripts/create-superadmin.mjs --email voce@empresa.com --password "SuaSenhaForte123!"
 *
 * O token de provisionamento vem de SETUP_TOKEN (ambiente) ou do arquivo
 * .env.setup na raiz do projeto. Quando a senha não é informada, o script gera
 * uma senha forte localmente e a exibe uma única vez — ela nunca é armazenada.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readArgs(argv) {
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

function loadSetupToken() {
  if (process.env.SETUP_TOKEN) return process.env.SETUP_TOKEN.trim();
  const file = resolve(root, '.env.setup');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find(item => item.startsWith('SETUP_TOKEN='));
  return line ? line.slice('SETUP_TOKEN='.length).replace(/^["']|["']$/g, '').trim() : '';
}

function generatePassword() {
  // 28 caracteres cobrindo as quatro classes exigidas pelo servidor.
  return `Aa1!${randomBytes(18).toString('base64url')}`;
}

const args = readArgs(process.argv.slice(2));
const baseUrl = String(args.url || process.env.APP_URL || 'https://auditai-dev.vercel.app').replace(/\/+$/, '');
const token = args.token ? String(args.token) : loadSetupToken();

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-setup-token': token } : {}),
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function main() {
  if (args.check) {
    const health = await request('/api/health');
    const setup = await request('/api/setup/status');
    console.log('health :', health.status, JSON.stringify(health.body));
    console.log('setup  :', setup.status, JSON.stringify(setup.body));
    return;
  }

  const email = String(args.email || '').trim().toLowerCase();
  if (!email) {
    console.error('Informe o e-mail: --email voce@empresa.com');
    process.exit(1);
  }
  if (!token) {
    console.error('Defina SETUP_TOKEN no ambiente ou no arquivo .env.setup.');
    process.exit(1);
  }

  const password = args.password ? String(args.password) : generatePassword();
  if (password.length < 16) {
    console.error('A senha deve ter ao menos 16 caracteres.');
    process.exit(1);
  }

  const { status, body } = await request('/api/setup/superadmin', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (status === 201) {
    console.log('\nSuperadministrador criado com sucesso.\n');
    console.log(`  E-mail : ${email}`);
    console.log(`  Senha  : ${password}`);
    console.log(`  Acesso : ${baseUrl}\n`);
    console.log('Guarde esta senha agora: ela não é exibida novamente e não fica armazenada.\n');
    return;
  }

  console.error(`Falha (${status}):`, body.error || JSON.stringify(body));
  process.exit(1);
}

main().catch(error => {
  console.error('Erro:', error.message);
  process.exit(1);
});

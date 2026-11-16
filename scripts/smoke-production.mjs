// Smoke test somente leitura da produção (health + login + leituras principais).
// Uso:
//   $env:PROD_EMAIL="<email-do-superadmin>"; $env:PROD_PASSWORD="..."; npm run smoke:prod
import { writeFileSync } from 'node:fs';

const BASE = (process.env.PROD_URL || 'https://auditai-dev.vercel.app').replace(/\/+$/, '');
const EMAIL = process.env.PROD_EMAIL;
const PASSWORD = process.env.PROD_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Defina PROD_EMAIL e PROD_PASSWORD.');
  process.exit(1);
}

const out = { base: BASE, startedAt: new Date().toISOString(), checks: [] };
const add = (name, ok, detail = '') => {
  out.checks.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const health = await (await fetch(`${BASE}/api/health`)).json();
add('health ok', health.ok === true, `mode=${health.mode} v=${health.stateVersion}`);
add('health: persistência', health.persistence === 'ready');
add('health: sem conflitos', health.stateConflicts === 0);
add('health: 1 superadmin', health.superAdminCount === 1);

const loginRes = await fetch(`${BASE}/api/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await loginRes.json().catch(() => ({}));
add('login superadmin', loginRes.status === 200 && login?.user?.role === 'superadmin');
const cookie = String(loginRes.headers.get('set-cookie') || '').split(';')[0];

const getJson = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const users = await getJson('/api/users');
const tenants = await getJson('/api/tenants');
const chats = await getJson('/api/chats');
const integrations = await getJson('/api/integrations');
const config = await getJson('/api/config');

add('users', Array.isArray(users.body) && users.body.length >= 1, `count=${Array.isArray(users.body) ? users.body.length : '?'}`);
add('tenants', tenants.status === 200 && Array.isArray(tenants.body?.tenants), `count=${tenants.body?.tenants?.length}`);
add('chats', chats.status === 200 && Array.isArray(chats.body), `count=${Array.isArray(chats.body) ? chats.body.length : '?'}`);
add('integrações', integrations.status === 200 && (integrations.body?.systems?.length || 0) === 7, `systems=${integrations.body?.systems?.length}`);
add('config', config.status === 200 && Array.isArray(config.body?.guiaItens), `guia=${config.body?.guiaItens?.length} blocos=${config.body?.blocos?.length}`);

out.finishedAt = new Date().toISOString();
writeFileSync('.scratch/last-prod-smoke.json', JSON.stringify(out, null, 2), 'utf8');
const failed = out.checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nSmoke de produção OK.');

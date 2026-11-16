// Verifica o schema do Estágio 3 num Postgres de staging (Docker/Neon branch).
// Uso: STAGE3_DATABASE_URL=postgresql://... node scripts/db-verify.mjs
import { Client } from 'pg';

const url = process.env.STAGE3_DATABASE_URL;
if (!url) {
  console.error('Defina STAGE3_DATABASE_URL.');
  process.exit(1);
}

const expectedTables = [
  'tenants', 'users', 'memberships', 'interactions', 'interaction_transcripts',
  'config_scopes', 'integration_catalog', 'integration_tenant_configs', 'audit_log',
];
const rlsTables = [
  'tenants', 'users', 'memberships', 'interactions', 'interaction_transcripts',
  'config_scopes', 'integration_tenant_configs', 'audit_log',
];
const expectedPolicies = [
  'tenants_scope', 'users_scope', 'memberships_scope', 'interactions_scope',
  'interaction_transcripts_scope', 'config_scopes_scope',
  'integration_tenant_configs_scope', 'audit_log_select', 'audit_log_insert',
];

const client = new Client({ connectionString: url });
await client.connect();
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name} ${detail}`); else console.log(`✓ ${name}`); };

try {
  const tables = (await client.query(`select table_name from information_schema.tables where table_schema='public'`)).rows.map((r) => r.table_name);
  for (const t of expectedTables) check(`tabela ${t}`, tables.includes(t));

  const policies = (await client.query(`select policyname from pg_policies where schemaname='public'`)).rows.map((r) => r.policyname);
  for (const p of expectedPolicies) check(`policy ${p}`, policies.includes(p));

  const rls = (await client.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname = any($1)`, [rlsTables])).rows;
  check('RLS habilitado em todas as tabelas', rls.every((r) => r.relrowsecurity), JSON.stringify(rls.filter((r) => !r.relrowsecurity)));

  const roles = (await client.query(`select rolname from pg_roles where rolname in ('app_rw','app_ro')`)).rows.map((r) => r.rolname);
  check('roles app_rw/app_ro', roles.length === 2, roles.join(','));

  // teste funcional de isolamento dentro de transação revertida
  await client.query('begin');
  await client.query(`insert into tenants (id, name, slug) values
    ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'tenant-a'),
    ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'tenant-b')`);
  await client.query(`insert into interactions (tenant_id, channel, external_id, audit_status) values
    ('11111111-1111-1111-1111-111111111111', 'audio', 'A-1', 'pending'),
    ('22222222-2222-2222-2222-222222222222', 'chat', 'B-1', 'pending')`);
  await client.query('rollback');

  await client.query('begin');
  await client.query(`insert into tenants (id, name, slug) values
    ('33333333-3333-3333-3333-333333333333', 'Tenant C', 'tenant-c')`);
  await client.query(`insert into interactions (tenant_id, channel, external_id) values
    ('33333333-3333-3333-3333-333333333333', 'audio', 'C-1')`);
  await client.query(`set local role app_rw`);
  await client.query(`select set_config('app.tenant_id', '33333333-3333-3333-3333-333333333333', true)`);
  const visible = (await client.query('select count(*)::int as n from interactions')).rows[0].n;
  check('RLS filtra interações da tenant', visible === 1, `visíveis=${visible}`);
  await client.query('rollback');
} finally {
  await client.end();
}

if (failures.length) {
  console.error('\nFalhas:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('\nSchema do Estágio 3 validado com sucesso.');

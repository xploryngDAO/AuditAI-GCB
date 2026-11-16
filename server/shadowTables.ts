/**
 * Estágio 1 da normalização: espelha o documento JSON nas tabelas relacionais.
 *
 * - Best-effort: qualquer falha é registrada e nunca propaga para a requisição.
 * - O documento (`platform_state`) continua sendo a fonte da verdade.
 * - As tabelas são criadas no primeiro sync (DDL idempotente).
 * - `tenants` é criada aqui, mas sua escrita passou a ser responsabilidade do
 *   Estágio 2 (`server/tenantStore.ts`), que reconcilia de forma aguardada.
 */

import { ensureTenantsTable } from "./tenantStore.ts";
import { ignoreConcurrentDdl } from "./ddl.ts";

export type ShadowStatus = {
  enabled: boolean;
  tenants: number;
  users: number;
  interactions: number;
  truncated: boolean;
  syncedAt: string | null;
  lastError: string | null;
};

const DEFAULT_LIMIT = 500;

let ready = false;
let running: Promise<void> | null = null;
// Guarda só o snapshot mais recente: em vez de pular o ciclo (como o antigo
// `inFlight` fazia), o próximo run começa assim que o atual termina.
let queued: SyncOptions | null = null;
let status: ShadowStatus = {
  enabled: false,
  tenants: 0,
  users: 0,
  interactions: 0,
  truncated: false,
  syncedAt: null,
  lastError: null
};

type SyncOptions = {
  sql: any;
  data: any;
  enabled: boolean;
  limit?: number;
};

export function getShadowStatus(): ShadowStatus {
  return status;
}

export function syncShadowTables(opts: SyncOptions): Promise<void> {
  status = { ...status, enabled: opts.enabled };

  if (!opts.enabled || !opts.sql) return Promise.resolve();
  if (running) {
    queued = opts;
    return running;
  }

  running = runSync(opts).finally(() => {
    running = null;
    const next = queued;
    queued = null;
    if (next) void syncShadowTables(next);
  });
  return running;
}

async function runSync(opts: SyncOptions): Promise<void> {
  const { sql, data } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const users: any[] = Array.isArray(data?.usersDb) ? data.usersDb : [];
  const allInteractions: any[] = Array.isArray(data?.interactionsDb) ? data.interactionsDb : [];
  const interactions = allInteractions.slice(0, limit);

  try {
    if (!ready) {
      await ensureTenantsTable(sql);
      await ignoreConcurrentDdl(() => sql`create table if not exists app_users (
        email text primary key, password_hash text not null, role text not null,
        tenant_id text, bpo_name text, created_at timestamptz default now()
      )`);
      await ignoreConcurrentDdl(() => sql`create table if not exists interactions (
        id text primary key, tenant_id text, bpo_name text, agent_name text,
        audit_status text, payload jsonb not null, created_at timestamptz default now()
      )`);
      await ignoreConcurrentDdl(() => sql`create index if not exists interactions_tenant_idx on interactions (tenant_id, created_at desc)`);
      ready = true;
    }

    for (const user of users) {
      const email = String(user?.email ?? '').trim().toLowerCase();
      if (!email || !user?.passwordHash) continue;
      await sql`insert into app_users (email, password_hash, role, tenant_id, bpo_name)
        values (${email}, ${user.passwordHash}, ${user.role ?? 'bpo'}, ${user.tenantId ?? null}, ${user.bpoName ?? null})
        on conflict (email) do update set password_hash = excluded.password_hash, role = excluded.role,
          tenant_id = excluded.tenant_id, bpo_name = excluded.bpo_name`;
    }

    // Usuário removido do documento não pode continuar no espelho.
    const liveEmails = new Set(
      users.map((user: any) => String(user?.email ?? '').trim().toLowerCase()).filter(Boolean)
    );
    const mirroredUsers: any[] = await sql`select email from app_users`;
    for (const row of mirroredUsers) {
      const email = String((row as any)?.email ?? '').toLowerCase();
      if (email && !liveEmails.has(email)) await sql`delete from app_users where email = ${email}`;
    }

    for (const item of interactions) {
      if (!item?.id) continue;
      await sql`insert into interactions (id, tenant_id, bpo_name, agent_name, audit_status, payload)
        values (${String(item.id)}, ${item.tenantId ?? null}, ${item.bpoName ?? null}, ${item.agentName ?? null}, ${item.auditStatus ?? null}, ${JSON.stringify(item)}::jsonb)
        on conflict (id) do update set tenant_id = excluded.tenant_id, bpo_name = excluded.bpo_name,
          agent_name = excluded.agent_name, audit_status = excluded.audit_status, payload = excluded.payload`;
    }

    const tenantRows = await sql`select count(*)::int as n from tenants`;
    const userRows = await sql`select count(*)::int as n from app_users`;
    const interactionRows = await sql`select count(*)::int as n from interactions`;

    status = {
      enabled: true,
      tenants: Number((tenantRows[0] as any)?.n) || 0,
      users: Number((userRows[0] as any)?.n) || 0,
      interactions: Number((interactionRows[0] as any)?.n) || 0,
      truncated: allInteractions.length > limit,
      syncedAt: new Date().toISOString(),
      lastError: null
    };
  } catch (error) {
    status = {
      ...status,
      syncedAt: new Date().toISOString(),
      lastError: error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error)
    };
    console.warn('[shadow] Falha ao espelhar tabelas relacionais:', status.lastError);
  }
}

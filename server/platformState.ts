/**
 * Persistência do documento `platform_state`.
 *
 * O estado é um único JSON versionado. A gravação usa INSERT ... ON CONFLICT
 * com guarda de versão para que a primeira gravação em um banco vazio crie a
 * linha `primary` (o UPDATE anterior nunca criava nada) e para que escritas
 * concorrentes não se sobrescrevam silenciosamente.
 */

import { ignoreConcurrentDdl } from "./ddl.ts";

export type PersistedState = {
  state: unknown;
  version: number;
};

export async function ensurePlatformStateTable(sql: any): Promise<void> {
  await ignoreConcurrentDdl(() => sql`create table if not exists platform_state (
    id text primary key,
    state jsonb not null,
    updated_at timestamptz not null default now(),
    version integer not null default 0
  )`);
  await ignoreConcurrentDdl(() => sql`alter table platform_state add column if not exists version integer not null default 0`);
}

export async function readPlatformState(sql: any): Promise<PersistedState | null> {
  const rows = await sql`select state, version from platform_state where id = 'primary'`;
  if (!rows.length) return null;
  let state = (rows[0] as any).state;
  if (typeof state === "string") state = JSON.parse(state);
  return { state, version: Number((rows[0] as any).version) || 0 };
}

/**
 * Leitura barata usada a cada request para descobrir se outra instância
 * gravou uma versão mais nova antes de decidir recarregar o documento.
 */
export async function readPlatformStateVersion(sql: any): Promise<number> {
  const rows = await sql`select version from platform_state where id = 'primary'`;
  if (!rows.length) return 0;
  return Number((rows[0] as any).version) || 0;
}

/**
 * Grava o documento se `expectedVersion` ainda for a versão corrente.
 * Devolve `null` quando houve conflito (o chamador relê a versão e tenta de novo).
 */
export async function writePlatformState(
  sql: any,
  payload: string,
  expectedVersion: number
): Promise<{ version: number } | null> {
  const rows = await sql`insert into platform_state (id, state, version, updated_at)
    values ('primary', ${payload}::jsonb, ${expectedVersion} + 1, now())
    on conflict (id) do update
      set state = excluded.state, version = platform_state.version + 1, updated_at = now()
      where platform_state.version = ${expectedVersion}
    returning version`;
  if (!rows.length) return null;
  return { version: Number((rows[0] as any).version) || expectedVersion + 1 };
}

/**
 * Estágio 2 da normalização: a tabela `tenants` passa a servir as leituras.
 *
 * - `GET /api/tenants` tenta ler da tabela relacional e só cai para o documento
 *   (`platform_state`) quando a tabela não está disponível ou divergiu.
 * - A decisão é conservadora: qualquer divergência (linha faltando, sobrando ou
 *   com campo diferente) faz a requisição usar o documento, que continua sendo a
 *   fonte da verdade. Assim, o espelho assíncrono do Estágio 1 nunca serve dado
 *   desatualizado.
 * - `/api/health` acompanha a paridade (contagens + `inSync`) sem expor dados de
 *   tenant na rota pública.
 */

import crypto from "crypto";
import type { Tenant } from "../src/types";
import { ignoreConcurrentDdl } from "./ddl.ts";

export type TenantReadSource = "table" | "document";

export type TenantReadReason =
  | "table_missing"
  | "table_empty"
  | "parity_mismatch"
  | "read_failed"
  | "timeout"
  | "storage_not_configured";

export type TenantDrift = {
  missing: number;
  extra: number;
  changed: number;
};

export type TenantStoreStatus = {
  enabled: boolean;
  available: boolean;
  source: TenantReadSource;
  reason: TenantReadReason | null;
  tableCount: number;
  documentCount: number;
  inSync: boolean;
  drift: TenantDrift;
  checkedAt: string | null;
  lastError: string | null;
  digest: { table: string | null; document: string | null };
};

const TENANT_READ_TIMEOUT_MS = 4_000;
const TENANT_WRITE_TIMEOUT_MS = 3_000;
const PARITY_TTL_MS = 20_000;
const PARITY_TIMEOUT_MS = 2_500;

const DEFAULTS: TenantStoreStatus = {
  enabled: false,
  available: false,
  source: "document",
  reason: "storage_not_configured",
  tableCount: 0,
  documentCount: 0,
  inSync: false,
  drift: { missing: 0, extra: 0, changed: 0 },
  checkedAt: null,
  lastError: null,
  digest: { table: null, document: null }
};

let status: TenantStoreStatus = {
  ...DEFAULTS,
  drift: { ...DEFAULTS.drift },
  digest: { ...DEFAULTS.digest }
};
let lastCheckAt = 0;
let pending: Promise<void> | null = null;

/** Versão pública: sem mensagem de erro interna e sem digest (não vaza tenant). */
export function publicTenantStoreStatus(value: TenantStoreStatus): Omit<TenantStoreStatus, "lastError" | "digest"> {
  const { lastError: _lastError, digest: _digest, ...rest } = value;
  return rest;
}

/**
 * DDL idempotente da tabela `tenants`. Fica aqui porque este módulo é o dono da
 * leitura; o Estágio 1 importa a mesma definição para não haver duas versões.
 */
export async function ensureTenantsTable(sql: any): Promise<void> {
  await ignoreConcurrentDdl(() => sql`create table if not exists tenants (
    id text primary key, name text not null, slug text, cnpj text, active boolean default true,
    admin_email text, parent_id text, is_subtenant boolean default false, bpo_name text,
    plan text, created_at timestamptz default now()
  )`);
}

type CanonicalTenant = {
  id: string;
  name: string;
  slug: string | null;
  cnpj: string | null;
  active: boolean;
  adminEmail: string | null;
  parentId: string | null;
  isSubtenant: boolean;
  bpoName: string | null;
  plan: string | null;
};

function canonicalTenant(value: any): CanonicalTenant | null {
  if (!value || value.id === undefined || value.id === null) return null;
  return {
    id: String(value.id),
    name: String(value.name ?? ""),
    slug: value.slug ?? null,
    cnpj: value.cnpj ?? null,
    active: Boolean(value.active ?? true),
    adminEmail: value.adminEmail ?? null,
    parentId: value.parentId ?? null,
    isSubtenant: Boolean(value.isSubtenant ?? false),
    bpoName: value.bpoName ?? null,
    plan: value.plan ?? null
  };
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return "";
}

function tenantFromRow(row: any): Tenant | null {
  const canonical = canonicalTenant(row);
  if (!canonical) return null;
  const tenant: Tenant = {
    id: canonical.id,
    name: canonical.name,
    active: canonical.active,
    adminEmail: canonical.adminEmail ?? "",
    createdAt: isoDate(row.createdAt),
    parentId: canonical.parentId,
    isSubtenant: canonical.isSubtenant
  };
  if (canonical.slug !== null) tenant.slug = canonical.slug;
  if (canonical.cnpj !== null) tenant.cnpj = canonical.cnpj;
  if (canonical.bpoName !== null) tenant.bpoName = canonical.bpoName;
  if (canonical.plan !== null) tenant.plan = canonical.plan as Tenant["plan"];
  return tenant;
}

function tenantDigest(items: CanonicalTenant[]): string {
  const canonical = [...items].sort((a, b) => a.id.localeCompare(b.id));
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms);
    (timer as any).unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function readTenantsTable(sql: any): Promise<Tenant[]> {
  const rows = await sql`select id, name, slug, cnpj, active,
      admin_email as "adminEmail", parent_id as "parentId",
      is_subtenant as "isSubtenant", bpo_name as "bpoName", plan,
      created_at as "createdAt"
    from tenants`;
  return rows
    .map(tenantFromRow)
    .filter((tenant: Tenant | null): tenant is Tenant => tenant !== null);
}

function classifyReadFailure(error: unknown): { reason: TenantReadReason; message: string } {
  const message = error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error);
  if (/timeout_after_\d+ms/.test(message)) return { reason: "timeout", message };
  if (/relation .* does not exist|42P01/i.test(message)) return { reason: "table_missing", message };
  return { reason: "read_failed", message };
}

/**
 * Escrita do Estágio 2: deixa a tabela `tenants` idêntica ao documento.
 * É aguardada nos endpoints que alteram tenants: o espelho best-effort do
 * Estágio 1 pode ser pulado (`inFlight`) ou congelado em serverless, e a
 * leitura não pode depender dele.
 */
async function reconcileTenantsTable(sql: any, tenants: Tenant[]): Promise<void> {
  await ensureTenantsTable(sql);
  const wanted = new Set<string>();
  for (const tenant of tenants) {
    if (!tenant?.id) continue;
    const id = String(tenant.id);
    wanted.add(id);
    await sql`insert into tenants (id, name, slug, cnpj, active, admin_email, parent_id, is_subtenant, bpo_name, plan, created_at)
      values (${id}, ${tenant.name ?? id}, ${tenant.slug ?? null}, ${tenant.cnpj ?? null}, ${tenant.active ?? true}, ${tenant.adminEmail ?? null}, ${tenant.parentId ?? null}, ${tenant.isSubtenant ?? false}, ${tenant.bpoName ?? null}, ${tenant.plan ?? null}, ${tenant.createdAt || new Date().toISOString()})
      on conflict (id) do update set name = excluded.name, slug = excluded.slug, cnpj = excluded.cnpj,
        active = excluded.active, admin_email = excluded.admin_email, parent_id = excluded.parent_id,
        is_subtenant = excluded.is_subtenant, bpo_name = excluded.bpo_name, plan = excluded.plan`;
  }

  const mirrored: any[] = await sql`select id from tenants`;
  for (const row of mirrored) {
    const id = String((row as any)?.id ?? "");
    if (id && !wanted.has(id)) await sql`delete from tenants where id = ${id}`;
  }
}

/** Best-effort: nunca lança e devolve o resultado para diagnóstico. */
export async function syncTenantsTable(opts: {
  sql: any;
  enabled: boolean;
  document: Tenant[];
  timeoutMs?: number;
}): Promise<{ ok: boolean; error: string | null }> {
  if (!opts.enabled || !opts.sql) return { ok: false, error: "storage_not_configured" };
  try {
    await withTimeout(reconcileTenantsTable(opts.sql, opts.document), opts.timeoutMs ?? TENANT_WRITE_TIMEOUT_MS);
    invalidateTenantParity();
    return { ok: true, error: null };
  } catch (error) {
    invalidateTenantParity();
    const message = error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error);
    console.warn("[tenants] Falha ao reconciliar a tabela tenants:", message);
    return { ok: false, error: message };
  }
}

/**
 * Resolve a lista de tenants para leitura: tabela quando disponível e idêntica
 * ao documento; documento em todos os outros casos. Nunca lança.
 */
export async function resolveTenants(opts: {
  sql: any;
  enabled: boolean;
  document: Tenant[];
  timeoutMs?: number;
}): Promise<{ tenants: Tenant[]; source: TenantReadSource; status: TenantStoreStatus }> {
  const document = Array.isArray(opts.document) ? opts.document : [];
  const documentCanonical = document
    .map(canonicalTenant)
    .filter((item): item is CanonicalTenant => item !== null);
  const documentById = new Map(documentCanonical.map((item) => [item.id, item]));
  const documentDigest = tenantDigest(documentCanonical);

  const fallback = (reason: TenantReadReason, extra: Partial<TenantStoreStatus> = {}) => {
    const notConfigured = reason === "storage_not_configured";
    status = {
      enabled: opts.enabled,
      available: false,
      source: "document",
      reason,
      tableCount: 0,
      documentCount: document.length,
      inSync: false,
      drift: notConfigured
        ? { missing: 0, extra: 0, changed: 0 }
        : { missing: documentCanonical.length, extra: 0, changed: 0 },
      checkedAt: new Date().toISOString(),
      lastError: null,
      digest: { table: null, document: documentDigest },
      ...extra
    };
    lastCheckAt = Date.now();
    return { tenants: document, source: "document" as TenantReadSource, status };
  };

  if (!opts.enabled || !opts.sql) return fallback("storage_not_configured");

  let rows: Tenant[];
  try {
    rows = await withTimeout(readTenantsTable(opts.sql), opts.timeoutMs ?? TENANT_READ_TIMEOUT_MS);
  } catch (error) {
    const failure = classifyReadFailure(error);
    return fallback(failure.reason, { lastError: failure.message });
  }

  const tableCanonical = rows
    .map(canonicalTenant)
    .filter((item): item is CanonicalTenant => item !== null);
  const tableById = new Map(tableCanonical.map((item) => [item.id, item]));

  let missing = 0;
  let changed = 0;
  for (const item of documentCanonical) {
    const row = tableById.get(item.id);
    if (!row) {
      missing += 1;
      continue;
    }
    if (JSON.stringify(row) !== JSON.stringify(item)) changed += 1;
  }
  let extra = 0;
  for (const row of tableCanonical) if (!documentById.has(row.id)) extra += 1;

  const inSync = missing === 0 && extra === 0 && changed === 0;
  const tableEmpty = tableCanonical.length === 0 && documentCanonical.length > 0;
  status = {
    enabled: true,
    available: true,
    source: inSync ? "table" : "document",
    reason: inSync ? null : tableEmpty ? "table_empty" : "parity_mismatch",
    tableCount: tableCanonical.length,
    documentCount: document.length,
    inSync,
    drift: { missing, extra, changed },
    checkedAt: new Date().toISOString(),
    lastError: null,
    digest: { table: tenantDigest(tableCanonical), document: documentDigest }
  };
  lastCheckAt = Date.now();

  if (!inSync) return { tenants: document, source: "document", status };

  // Ordem estável igual à do documento: o painel não deve reordenar ao trocar
  // a origem da leitura.
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const ordered = document
    .map((tenant) => rowsById.get(tenant.id))
    .filter((tenant): tenant is Tenant => Boolean(tenant));
  return { tenants: ordered, source: "table", status };
}

/**
 * Atualiza a paridade no máximo a cada TTL, para que `/api/health` reflita a
 * tabela sem transformar monitoramento em carga de banco.
 */
export async function refreshTenantParity(opts: {
  sql: any;
  enabled: boolean;
  document: Tenant[];
  maxAgeMs?: number;
  timeoutMs?: number;
}): Promise<TenantStoreStatus> {
  if (!opts.enabled || !opts.sql) {
    status = {
      ...DEFAULTS,
      enabled: false,
      documentCount: Array.isArray(opts.document) ? opts.document.length : 0,
      checkedAt: new Date().toISOString()
    };
    lastCheckAt = Date.now();
    return status;
  }
  if (lastCheckAt > 0 && Date.now() - lastCheckAt < (opts.maxAgeMs ?? PARITY_TTL_MS)) return status;
  if (pending) {
    await pending;
    return status;
  }
  pending = resolveTenants({ ...opts, timeoutMs: opts.timeoutMs ?? PARITY_TIMEOUT_MS })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      pending = null;
    });
  await pending;
  return status;
}

/** Permite que o próximo `/api/health` recheque a paridade imediatamente. */
export function invalidateTenantParity(): void {
  lastCheckAt = 0;
}

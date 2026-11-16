import test from "node:test";
import assert from "node:assert/strict";
import { publicTenantStoreStatus, resolveTenants, syncTenantsTable } from "../server/tenantStore.ts";

type FakeCall = { text: string; values: any[] };

function fakeSql(handler: (text: string, values: any[]) => any) {
  const calls: FakeCall[] = [];
  const fn: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    calls.push({ text, values });
    return handler(text, values);
  };
  return { fn, calls };
}

const document = [
  {
    id: "t1", name: "Alfa", slug: "alfa", cnpj: "11", active: true, adminEmail: "a@x.com",
    createdAt: "2026-01-01T00:00:00.000Z", parentId: null, isSubtenant: false, plan: "enterprise"
  },
  {
    id: "t2", name: "Beta", cnpj: "", active: false, adminEmail: "b@x.com",
    createdAt: "2026-02-01T00:00:00.000Z", parentId: "t1", isSubtenant: true, bpoName: "Beta", plan: "pro"
  }
] as any[];

function rows(items: any[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug ?? null,
    cnpj: item.cnpj ?? null,
    active: item.active ?? true,
    adminEmail: item.adminEmail ?? null,
    parentId: item.parentId ?? null,
    isSubtenant: item.isSubtenant ?? false,
    bpoName: item.bpoName ?? null,
    plan: item.plan ?? null,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date("2026-01-01T00:00:00.000Z")
  }));
}

const sqlRows = (data: any[]) => fakeSql(() => data).fn;
const sqlThrow = (message: string) => fakeSql(() => { throw new Error(message); }).fn;

test("tabela em sincronia: lê da tabela, preserva a ordem do documento e converte createdAt", async () => {
  const result = await resolveTenants({ sql: sqlRows(rows([...document].reverse())), enabled: true, document });
  assert.equal(result.source, "table");
  assert.deepEqual(result.tenants, document);
  assert.equal(result.status.inSync, true);
  assert.deepEqual(result.status.drift, { missing: 0, extra: 0, changed: 0 });
  assert.equal(result.status.digest.table, result.status.digest.document);
});

test("campo divergente: usa o documento e denuncia changed", async () => {
  const changed = rows(document);
  changed[0].name = "Alfa Antiga";
  const result = await resolveTenants({ sql: sqlRows(changed), enabled: true, document });
  assert.equal(result.source, "document");
  assert.deepEqual(result.tenants, document);
  assert.equal(result.status.reason, "parity_mismatch");
  assert.deepEqual(result.status.drift, { missing: 0, extra: 0, changed: 1 });
  assert.notEqual(result.status.digest.table, result.status.digest.document);
});

test("linha faltando ou sobrando: usa o documento", async () => {
  const missing = await resolveTenants({ sql: sqlRows(rows(document.slice(0, 1))), enabled: true, document });
  assert.equal(missing.source, "document");
  assert.deepEqual(missing.status.drift, { missing: 1, extra: 0, changed: 0 });

  const extra = await resolveTenants({
    sql: sqlRows(rows([...document, { id: "t3", name: "Órfã", active: true, adminEmail: "c@x.com", createdAt: "2026-03-01T00:00:00.000Z" }])),
    enabled: true,
    document
  });
  assert.equal(extra.source, "document");
  assert.deepEqual(extra.status.drift, { missing: 0, extra: 1, changed: 0 });
});

test("tabela vazia com documento preenchido: fallback com table_empty", async () => {
  const result = await resolveTenants({ sql: sqlRows([]), enabled: true, document });
  assert.equal(result.source, "document");
  assert.equal(result.status.reason, "table_empty");
  assert.equal(result.status.available, true);
});

test("tabela inexistente: fallback classificado, sem lançar", async () => {
  const result = await resolveTenants({
    sql: sqlThrow('relation "tenants" does not exist'),
    enabled: true,
    document
  });
  assert.equal(result.source, "document");
  assert.equal(result.status.reason, "table_missing");
  assert.equal(result.status.available, false);
  assert.match(String(result.status.lastError), /does not exist/);
});

test("storage não configurado: documento, sem alegar paridade", async () => {
  const result = await resolveTenants({ sql: null, enabled: false, document });
  assert.equal(result.source, "document");
  assert.equal(result.status.reason, "storage_not_configured");
  assert.equal(result.status.enabled, false);
  assert.deepEqual(result.status.drift, { missing: 0, extra: 0, changed: 0 });
});

test("documento e tabela vazios: paridade trivial na tabela", async () => {
  const result = await resolveTenants({ sql: sqlRows([]), enabled: true, document: [] });
  assert.equal(result.source, "table");
  assert.equal(result.status.inSync, true);
  assert.deepEqual(result.tenants, []);
});

test("nulls explícitos não geram falso drift", async () => {
  const withNulls = [{
    id: "t9", name: "Nulo", slug: null, cnpj: null, active: true, adminEmail: "n@x.com",
    createdAt: "2026-05-01T00:00:00.000Z", parentId: null, isSubtenant: false
  }] as any[];
  const result = await resolveTenants({ sql: sqlRows(rows(withNulls)), enabled: true, document: withNulls });
  assert.equal(result.status.inSync, true);
});

test("status público remove lastError e digest", async () => {
  const result = await resolveTenants({ sql: sqlRows(rows(document)), enabled: true, document });
  const publicStatus = publicTenantStoreStatus(result.status);
  assert.equal("lastError" in publicStatus, false);
  assert.equal("digest" in publicStatus, false);
  assert.equal(publicStatus.tableCount, document.length);
});

test("syncTenantsTable reconcilia upserts e remove linhas fora do documento", async () => {
  const fake = fakeSql((text) => {
    if (text.includes("select id from tenants")) return [{ id: "t1" }, { id: "stale" }];
    return [];
  });
  const result = await syncTenantsTable({ sql: fake.fn, enabled: true, document });
  assert.deepEqual(result, { ok: true, error: null });
  const inserts = fake.calls.filter((call) => call.text.includes("insert into tenants"));
  const deletes = fake.calls.filter((call) => call.text.includes("delete from tenants"));
  assert.equal(inserts.length, document.length);
  assert.equal(deletes.length, 1);
  assert.deepEqual(deletes[0].values, ["stale"]);
});

test("syncTenantsTable nunca lança quando o banco falha", async () => {
  const result = await syncTenantsTable({ sql: sqlThrow("connection refused"), enabled: true, document });
  assert.equal(result.ok, false);
  assert.match(String(result.error), /connection refused/);
});

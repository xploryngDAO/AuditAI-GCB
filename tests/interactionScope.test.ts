import test from "node:test";
import assert from "node:assert/strict";
import {
  bpoAliases,
  filterInteractionsForScope,
  interactionInScope,
  interactionOwnedByScope
} from "../src/utils/interactionScope.ts";

const tenants = [
  { id: "tenant-mtz", name: "Casas Bahia", parentId: null, isSubtenant: false, bpoName: undefined },
  { id: "tenant-aec", name: "AeC Online", parentId: "tenant-mtz", isSubtenant: true, bpoName: "AeC Online" },
  { id: "tenant-delta", name: "BPO Delta", parentId: "tenant-mtz", isSubtenant: true, bpoName: "B" },
  { id: "tenant-opsp", name: "Operação SP", parentId: "tenant-mtz", isSubtenant: true, bpoName: "BPO Omega" },
  { id: "tenant-outra-mtz", name: "Outra Matriz", parentId: null, isSubtenant: false, bpoName: undefined },
  { id: "tenant-clone", name: "BPO Delta", parentId: "tenant-outra-mtz", isSubtenant: true, bpoName: "BPO Delta" }
];

const interactions = [
  { id: "i1", tenantId: "tenant-mtz", bpoName: "AeC Online" },
  { id: "i2", tenantId: "tenant-aec", bpoName: "AeC Online" },
  { id: "i3", tenantId: "tenant-mtz", bpoName: "BPO Delta" },
  { id: "i4", tenantId: "tenant-delta", bpoName: "BPO Delta" },
  { id: "i5", tenantId: "tenant-delta", bpoName: "B" },
  { id: "i6", tenantId: "system-global", bpoName: "BPO Omega" },
  { id: "i7", tenantId: "tenant-mtz", bpoName: "BPO Omega" },
  { id: "i8", tenantId: "tenant-opsp", bpoName: "Operação SP" },
  { id: "i9", tenantId: "tenant-opsp", bpoName: "BPO Omega" },
  { id: "i10", tenantId: "tenant-outra-mtz", bpoName: "BPO Delta" },
  { id: "i11", tenantId: "tenant-clone", bpoName: "BPO Delta" }
] as any[];

const byId = (rows: any[]) => rows.map(r => r.id).sort();

const scope = (role: "superadmin" | "admin" | "bpo", tenantId: string) => ({ role, tenantId });

test("sub-tenant vê todos os próprios registros, mesmo com rótulo divergente", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("bpo", "tenant-delta"), requestedBpo: "B"
  });
  assert.deepEqual(byId(rows), ["i3", "i4", "i5"]);
});

test("sub-tenant vê herdados do pai/global apenas com alias do parceiro", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("bpo", "tenant-opsp")
  });
  assert.deepEqual(byId(rows), ["i6", "i7", "i8", "i9"]);
});

test("sub-tenant não vê registros de outra matriz/sub-tenant irmã", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("bpo", "tenant-delta")
  });
  assert.equal(rows.some(r => r.id === "i10" || r.id === "i11"), false);
});

test("matriz vê próprios + filhas e não vê system-global/outra matriz", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("admin", "tenant-mtz")
  });
  assert.deepEqual(byId(rows), ["i1", "i2", "i3", "i4", "i5", "i7", "i8", "i9"]);
});

test("filtro de BPO da matriz continua estrito", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("admin", "tenant-mtz"), requestedBpo: "BPO Omega"
  });
  assert.deepEqual(byId(rows), ["i7", "i9"]);
});

test("filtro de BPO da sub-tenant não esconde o próprio dado", () => {
  const rows = filterInteractionsForScope({
    interactions, tenants, scope: scope("bpo", "tenant-opsp"), requestedBpo: "BPO Omega"
  });
  assert.deepEqual(byId(rows), ["i6", "i7", "i8", "i9"]);
});

test("superadmin global vê tudo; com tenant específico vê o escopo daquele tenant", () => {
  const all = filterInteractionsForScope({ interactions, tenants, scope: scope("superadmin", "system-global") });
  assert.equal(all.length, interactions.length);

  const scoped = filterInteractionsForScope({
    interactions, tenants, scope: scope("superadmin", "system-global"), requestedTenantId: "tenant-delta"
  });
  assert.deepEqual(byId(scoped), ["i3", "i4", "i5"]);
});

test("aliases do parceiro incluem bpoName e name", () => {
  const aliases = bpoAliases(tenants[2]);
  assert.equal(aliases.has("b"), true);
  assert.equal(aliases.has("bpo delta"), true);
});

test("posse estrita não inclui dados herdados (mutação pontual)", () => {
  const delta = tenants[2];
  assert.equal(interactionOwnedByScope({ tenantId: "tenant-delta", bpoName: "B" }, delta, tenants), true);
  assert.equal(interactionOwnedByScope({ tenantId: "tenant-mtz", bpoName: "BPO Delta" }, delta, tenants), false);
  assert.equal(interactionOwnedByScope({ tenantId: "tenant-delta", bpoName: "B" }, tenants[0], tenants), true);
});

test("escopo de leitura de ida e volta é consistente com interactionInScope", () => {
  const aec = tenants[1];
  assert.equal(interactionInScope({ tenantId: "tenant-aec", bpoName: "AeC Online" }, aec, tenants), true);
  assert.equal(interactionInScope({ tenantId: "tenant-mtz", bpoName: "AeC Online" }, aec, tenants), true);
  assert.equal(interactionInScope({ tenantId: "tenant-mtz", bpoName: "BPO Omega" }, aec, tenants), false);
});

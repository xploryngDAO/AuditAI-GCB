import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInteractionBackfill,
  planInteractionTenantBackfill
} from "../src/utils/interactionBackfill.ts";

const tenants = [
  { id: "tenant-mtz", name: "Casas Bahia", parentId: null, isSubtenant: false, bpoName: undefined },
  { id: "tenant-delta", name: "Delta Operações", parentId: "tenant-mtz", isSubtenant: true, bpoName: "B" },
  { id: "tenant-opsp", name: "Operação SP", parentId: "tenant-mtz", isSubtenant: true, bpoName: "BPO Omega" },
  { id: "tenant-outra", name: "Outra Matriz", parentId: null, isSubtenant: false, bpoName: undefined },
  { id: "tenant-clone", name: "BPO Delta", parentId: "tenant-outra", isSubtenant: true, bpoName: "BPO Delta" }
];

const interaction = (id: string, tenantId: string | undefined, bpoName: string) => ({ id, tenantId, bpoName });

test("migra registro da matriz atribuído ao BPO do sub-tenant", () => {
  const plan = planInteractionTenantBackfill([interaction("i1", "tenant-mtz", "B")], tenants);
  assert.deepEqual(plan.proposals, [{
    interactionId: "i1",
    fromTenantId: "tenant-mtz",
    fromBpoName: "B",
    toTenantId: "tenant-delta",
    toBpoName: "B",
    reason: "inherited-bpo"
  }]);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.ambiguities.length, 0);
});

test("migra registro system-global e sem dono", () => {
  const plan = planInteractionTenantBackfill([
    interaction("i2", "system-global", "Operação SP"),
    interaction("i3", undefined, "BPO Omega")
  ], tenants);
  assert.deepEqual(plan.proposals.map(p => [p.interactionId, p.toTenantId]), [
    ["i2", "tenant-opsp"],
    ["i3", "tenant-opsp"]
  ]);
});

test("normaliza rótulo de registro que já pertence ao sub-tenant", () => {
  const plan = planInteractionTenantBackfill([interaction("i4", "tenant-delta", "Delta Operações")], tenants);
  assert.deepEqual(plan.proposals, [{
    interactionId: "i4",
    fromTenantId: "tenant-delta",
    fromBpoName: "Delta Operações",
    toTenantId: "tenant-delta",
    toBpoName: "B",
    reason: "normalize-label"
  }]);
});

test("NÃO migra registro de outra tenant (conflito)", () => {
  const plan = planInteractionTenantBackfill([interaction("i5", "tenant-outra", "Delta Operações")], tenants);
  assert.equal(plan.proposals.length, 0);
  assert.deepEqual(plan.conflicts, [{ interactionId: "i5", bpoName: "Delta Operações", currentTenantId: "tenant-outra" }]);
});

test("rótulo ambíguo não é migrado", () => {
  const ambiguousTenants = [
    ...tenants,
    { id: "tenant-delta-2", name: "BPO Delta 2", parentId: "tenant-outra", isSubtenant: true, bpoName: "B" }
  ];
  const plan = planInteractionTenantBackfill([interaction("i6", "tenant-mtz", "B")], ambiguousTenants);
  assert.equal(plan.proposals.length, 0);
  assert.equal(plan.ambiguities.length, 1);
  assert.deepEqual(plan.ambiguities[0].candidateTenantIds, ["tenant-delta", "tenant-delta-2"]);
});

test("registro já canônico não gera proposta", () => {
  const plan = planInteractionTenantBackfill([interaction("i7", "tenant-delta", "B")], tenants);
  assert.equal(plan.proposals.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("backfill é idempotente (segunda execução sem propostas)", () => {
  const original = [
    interaction("i1", "tenant-mtz", "B"),
    interaction("i2", "system-global", "Operação SP"),
    interaction("i3", "tenant-outra", "Delta Operações")
  ];
  const plan = planInteractionTenantBackfill(original, tenants);
  const applied = applyInteractionBackfill(original, plan);
  const secondPlan = planInteractionTenantBackfill(applied, tenants);
  assert.equal(secondPlan.proposals.length, 0);
  assert.equal(secondPlan.conflicts.length, 1); // i3 continua conflito e intocado
  const i1 = applied.find(i => i.id === "i1");
  assert.equal(i1?.tenantId, "tenant-delta");
  assert.equal(i1?.bpoName, "B");
});

test("rótulo sem sub-tenant correspondente fica inalterado", () => {
  const plan = planInteractionTenantBackfill([interaction("i8", "tenant-mtz", "BPO Inexistente")], tenants);
  assert.equal(plan.proposals.length, 0);
  assert.equal(plan.unchanged, 1);
});

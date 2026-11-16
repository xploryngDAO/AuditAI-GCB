import test from "node:test";
import assert from "node:assert/strict";
import {
  GLOBAL_TENANT_ID,
  effectiveUserTenantId,
  isGlobalTenantId,
  isSuperadminRole,
  normalizeSuperadminScopes
} from "../src/utils/userScope.ts";

test("identifica o papel de SaaS Master", () => {
  assert.equal(isSuperadminRole("superadmin"), true);
  assert.equal(isSuperadminRole(" SUPERADMIN "), true);
  assert.equal(isSuperadminRole("admin"), false);
  assert.equal(isSuperadminRole(null), false);
  assert.equal(isSuperadminRole(undefined), false);
});

test("tenant efetivo do superadmin é sempre global", () => {
  assert.equal(effectiveUserTenantId("superadmin", "tenant-casas-bahia"), GLOBAL_TENANT_ID);
  assert.equal(effectiveUserTenantId("superadmin", null), GLOBAL_TENANT_ID);
  assert.equal(effectiveUserTenantId("admin", "tenant-casas-bahia"), "tenant-casas-bahia");
  assert.equal(effectiveUserTenantId("bpo", undefined), GLOBAL_TENANT_ID);
  assert.equal(effectiveUserTenantId("admin", "  tenant-x  "), "tenant-x");
});

test("reconhece o sentinela de escopo global", () => {
  assert.equal(isGlobalTenantId(GLOBAL_TENANT_ID), true);
  assert.equal(isGlobalTenantId(" system-global "), true);
  assert.equal(isGlobalTenantId("tenant-x"), false);
  assert.equal(isGlobalTenantId(null), false);
});

test("normaliza superadmin preso a um tenant preservando as demais contas", () => {
  const users = [
    { email: "master@empresa.com", role: "superadmin", tenantId: "tenant-casas-bahia" },
    { email: "admin@casasbahia.com", role: "admin", tenantId: "tenant-casas-bahia" },
    { email: "operador@bpo.com", role: "bpo", tenantId: "tenant-ac" },
    { email: "outro-master@empresa.com", role: "superadmin", tenantId: GLOBAL_TENANT_ID }
  ];

  const result = normalizeSuperadminScopes(users);

  assert.equal(result.changed, true);
  assert.equal(result.users[0].tenantId, GLOBAL_TENANT_ID);
  assert.equal(result.users[1].tenantId, "tenant-casas-bahia");
  assert.equal(result.users[2].tenantId, "tenant-ac");
  assert.equal(result.users[3].tenantId, GLOBAL_TENANT_ID);
  // Não muta o array original.
  assert.equal(users[0].tenantId, "tenant-casas-bahia");
});

test("normalização é idempotente quando não há vínculo indevido", () => {
  const users = [
    { email: "master@empresa.com", role: "superadmin", tenantId: GLOBAL_TENANT_ID },
    { email: "admin@casasbahia.com", role: "admin", tenantId: "tenant-casas-bahia" }
  ];

  const result = normalizeSuperadminScopes(users);

  assert.equal(result.changed, false);
  assert.equal(result.users[0].tenantId, GLOBAL_TENANT_ID);
  assert.equal(result.users[1].tenantId, "tenant-casas-bahia");
});

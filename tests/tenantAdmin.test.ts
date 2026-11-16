import test from "node:test";
import assert from "node:assert/strict";
import {
  findTenantAdminMismatches,
  planTenantAdminEmailChange
} from "../src/utils/tenantAdmin.ts";

test("detecta tenant cujo adminEmail não tem usuário vinculado", () => {
  const tenants = [
    { id: "t1", name: "Casas Bahia", adminEmail: "admin@casasbahia.com.br" },
    { id: "t2", name: "Outra", adminEmail: "admin@outra.com" },
    { id: "t3", name: "Sem admin", adminEmail: null }
  ];
  const users = [
    { email: "admin@casasbahia.com.br", tenantId: "t1" },
    { email: "admin@outra.com", tenantId: "system-global" }
  ];

  assert.deepEqual(findTenantAdminMismatches(tenants, users), [
    { tenantId: "t2", name: "Outra", adminEmail: "admin@outra.com" }
  ]);
});

test("renomeia a conta do admin atual preservando a senha", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "admin@casasbahia.com" },
    "admin@casasbahia.com.br",
    [{ email: "admin@casasbahia.com", tenantId: "t1", role: "admin" }]
  );

  assert.deepEqual(plan, {
    ok: true,
    action: "rename",
    fromEmail: "admin@casasbahia.com",
    toEmail: "admin@casasbahia.com.br"
  });
});

test("vincula uma conta existente com o novo e-mail", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "admin@casasbahia.com" },
    "admin@casasbahia.com.br",
    [{ email: "admin@casasbahia.com.br", tenantId: "system-global", role: "admin" }]
  );

  assert.deepEqual(plan, { ok: true, action: "link", email: "admin@casasbahia.com.br" });
});

test("recusa troca sem usuário atual nem usuário com o novo e-mail", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "sumido@casasbahia.com" },
    "novo@casasbahia.com.br",
    []
  );

  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.status, 400);
    assert.match(plan.error, /Crie a conta/);
  }
});

test("recusa e-mail que já pertence a outro tenant", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "admin@casasbahia.com" },
    "admin@outro.com",
    [{ email: "admin@outro.com", tenantId: "t2", role: "admin" }]
  );

  assert.equal(plan.ok, false);
  if (!plan.ok) assert.equal(plan.status, 409);
});

test("recusa transformar um SaaS Master em administrador de tenant", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "admin@casasbahia.com" },
    "octaviano@empresa.com",
    [{ email: "octaviano@empresa.com", tenantId: "system-global", role: "superadmin" }]
  );

  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.equal(plan.status, 409);
    assert.match(plan.error, /SaaS Master/);
  }
});

test("normaliza caixa e espaços e valida formato", () => {
  const plan = planTenantAdminEmailChange(
    { id: "t1", adminEmail: "admin@casasbahia.com" },
    "  Admin@CasasBahia.com.BR ",
    [{ email: "admin@casasbahia.com", tenantId: "t1", role: "admin" }]
  );
  assert.equal(plan.ok, true);
  if (plan.ok && plan.action === "rename") assert.equal(plan.toEmail, "admin@casasbahia.com.br");

  const invalid = planTenantAdminEmailChange({ id: "t1", adminEmail: "a@b.com" }, "invalido", []);
  assert.equal(invalid.ok, false);
});

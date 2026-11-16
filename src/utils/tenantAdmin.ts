/**
 * Regras puras de consistência entre o `adminEmail` de um tenant e a conta de
 * usuário correspondente. Ficam fora do server.ts para poderem ser testadas e
 * para impedir que a tela mostre um administrador que não existe de fato.
 */

import { isSuperadminRole } from "./userScope.ts";

export type TenantAdminUser = {
  email: string;
  role?: string;
  tenantId?: string | null;
  bpoName?: string | null;
};

export type TenantAdminMismatch = {
  tenantId: string;
  name: string;
  adminEmail: string;
};

export type TenantAdminChangePlan =
  | { ok: true; action: "link"; email: string }
  | { ok: true; action: "rename"; fromEmail: string; toEmail: string }
  | { ok: false; status: number; error: string };

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Tenants cujo `adminEmail` não tem um usuário com o mesmo e-mail e o mesmo
 * `tenantId`. É o sintoma exato do incidente: tenant existe, admin não.
 */
export function findTenantAdminMismatches(
  tenants: Array<{ id: string; name: string; adminEmail?: string | null }>,
  users: TenantAdminUser[]
): TenantAdminMismatch[] {
  const linked = new Set(users.map((user) => `${normalizeEmail(user.email)}|${String(user.tenantId ?? "")}`));
  return tenants
    .filter((tenant) => {
      const email = normalizeEmail(tenant.adminEmail);
      return Boolean(email) && !linked.has(`${email}|${tenant.id}`);
    })
    .map((tenant) => ({
      tenantId: tenant.id,
      name: tenant.name,
      adminEmail: String(tenant.adminEmail)
    }));
}

/**
 * Decide como aplicar a troca de `adminEmail` de um tenant:
 * - renomeia a conta do admin atual, preservando a senha; ou
 * - vincula uma conta já existente com o novo e-mail; ou
 * - recusa, para não deixar o tenant apontando para um usuário inexistente.
 */
export function planTenantAdminEmailChange(
  tenant: { id: string; adminEmail?: string | null },
  newEmailRaw: unknown,
  users: TenantAdminUser[]
): TenantAdminChangePlan {
  const newEmail = normalizeEmail(newEmailRaw);
  if (!newEmail) {
    return { ok: false, status: 400, error: "Informe o e-mail do administrador do tenant." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { ok: false, status: 400, error: "E-mail do administrador inválido." };
  }

  const currentEmail = normalizeEmail(tenant.adminEmail);
  const byNewEmail = users.find((user) => normalizeEmail(user.email) === newEmail);

  // O SaaS Master é global e nunca pode ser transformado no administrador de
  // uma tenant: isso o "prenderia" a um tenant e tiraria o escopo global dele.
  if (byNewEmail && isSuperadminRole(byNewEmail.role)) {
    return {
      ok: false,
      status: 409,
      error: "Este e-mail pertence a um SaaS Master (superadmin) e não pode ser administrador de uma tenant. Use uma conta exclusiva do tenant."
    };
  }

  if (byNewEmail && byNewEmail.tenantId && byNewEmail.tenantId !== tenant.id && byNewEmail.tenantId !== "system-global") {
    return {
      ok: false,
      status: 409,
      error: "Este e-mail já pertence a outro tenant. Escolha outro administrador."
    };
  }

  if (byNewEmail) {
    return { ok: true, action: "link", email: newEmail };
  }

  const currentAdmin = users.find(
    (user) => normalizeEmail(user.email) === currentEmail && user.tenantId === tenant.id
  );

  if (currentAdmin) {
    return { ok: true, action: "rename", fromEmail: normalizeEmail(currentAdmin.email), toEmail: newEmail };
  }

  return {
    ok: false,
    status: 400,
    error: "Não existe usuário com o novo e-mail. Crie a conta em Gestão de Acessos antes de alterar o administrador do tenant."
  };
}

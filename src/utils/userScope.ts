/**
 * Regras de escopo de conta.
 *
 * O SaaS Master (papel `superadmin`) é GLOBAL: enxerga todos os tenants, mas
 * não pertence a nenhum. Todo vínculo `superadmin -> tenant` é um estado
 * inválido, normalmente resultado de o e-mail do master ser usado como
 * `adminEmail` de uma tenant (o login antigo "adotava" esse vínculo) ou de uma
 * edição de usuário que enviava `tenantId` para o master.
 *
 * As funções abaixo são puras e compartilhadas entre servidor, UI e testes para
 * que a definição de escopo fique em um único lugar.
 */

export const GLOBAL_TENANT_ID = "system-global";
export const GLOBAL_TENANT_NAME = "Sistema Global SaaS";
export const GLOBAL_SCOPE_LABEL = "Sistema Global (SaaS)";

export type ScopedUser = {
  role?: unknown;
  tenantId?: string | null;
};

export function isSuperadminRole(role: unknown): boolean {
  return String(role ?? "").trim().toLowerCase() === "superadmin";
}

export function isGlobalTenantId(tenantId: unknown): boolean {
  return String(tenantId ?? "").trim() === GLOBAL_TENANT_ID;
}

/**
 * Tenant efetivo de uma conta. Superadmin é SEMPRE global, mesmo que o
 * registro persistido ainda carregue um `tenantId` antigo (dado legado).
 */
export function effectiveUserTenantId(role: unknown, tenantId: unknown): string {
  if (isSuperadminRole(role)) return GLOBAL_TENANT_ID;
  const value = typeof tenantId === "string" ? tenantId.trim() : "";
  return value || GLOBAL_TENANT_ID;
}

/**
 * Corrige registros de superadmin que ficaram presos a um tenant.
 * Retorna o novo array e se houve mudança, para que o chamador só persista
 * quando houver algo a reparar.
 */
export function normalizeSuperadminScopes<T extends ScopedUser>(
  users: readonly T[]
): { users: T[]; changed: boolean } {
  let changed = false;
  const normalized = users.map((user) => {
    if (!isSuperadminRole(user.role) || isGlobalTenantId(user.tenantId)) return user;
    changed = true;
    return { ...user, tenantId: GLOBAL_TENANT_ID } as T;
  });
  return { users: normalized, changed };
}

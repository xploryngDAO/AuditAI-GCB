/**
 * Escopo canônico de interações multi-tenant.
 *
 * Regra:
 * - o DONO do registro é `interaction.tenantId` (não um rótulo);
 * - `bpoName` é apenas um agrupamento operacional;
 * - a sub-tenant enxerga os próprios registros + os registros herdados do
 *   tenant pai / `system-global` / sem dono, mas SOMENTE quando o rótulo
 *   operacional casa com os aliases calculados no servidor
 *   (`{tenant.bpoName, tenant.name}`). Isso evita o vazamento entre matrizes
 *   diferentes que tenham sub-tenants com o mesmo nome de BPO;
 * - a matriz enxerga os próprios registros + os das sub-tenants filhas;
 * - o filtro `requestedBpo` vindo do cliente é apenas de exibição: para
 *   sub-tenant ele nunca esconde o registro do próprio dono.
 *
 * Funções puras para permitir testes e uso no servidor e no cliente.
 */

import type { Interaction, Tenant } from "../types";

export type ScopeTenant = Pick<Tenant, "id" | "name" | "parentId" | "isSubtenant" | "bpoName">;
export type ScopeRole = "superadmin" | "admin" | "bpo";
export type ScopeUser = { role: ScopeRole; tenantId: string };
export type ScopedInteraction = Pick<Interaction, "tenantId" | "bpoName">;

const GLOBAL_TENANT_ID = "system-global";

const norm = (value: unknown): string => String(value ?? "").trim().toLowerCase();

/** Rótulos aceitos do parceiro BPO da sub-tenant (vínculo canônico + nome legado). */
export function bpoAliases(tenant: ScopeTenant): Set<string> {
  return new Set([tenant.bpoName, tenant.name].map(norm).filter(Boolean));
}

/** Autorização de LEITURA de uma interação para um tenant consultado. */
export function interactionInScope(
  interaction: ScopedInteraction,
  scopeTenant: ScopeTenant | undefined,
  allTenants: readonly ScopeTenant[]
): boolean {
  if (!scopeTenant) return false;
  const owner = norm(interaction.tenantId);

  if (!scopeTenant.parentId) {
    // Matriz: próprios + sub-tenants descendentes.
    if (owner === norm(scopeTenant.id)) return true;
    return allTenants.some(t => t.parentId === scopeTenant.id && norm(t.id) === owner);
  }

  // Sub-tenant: o próprio dono é sempre visível, mesmo com rótulo divergente.
  if (owner === norm(scopeTenant.id)) return true;
  // Herança apenas da matriz/global/sem-dono — nunca de outra tenant.
  const inheritedFrom = new Set([norm(scopeTenant.parentId), GLOBAL_TENANT_ID, ""]);
  if (!inheritedFrom.has(owner)) return false;
  return bpoAliases(scopeTenant).has(norm(interaction.bpoName));
}

/** Autorização ESTRITA de posse, para mutações pontuais (excluir/re-auditar um ID). */
export function interactionOwnedByScope(
  interaction: ScopedInteraction,
  scopeTenant: ScopeTenant | undefined,
  allTenants: readonly ScopeTenant[]
): boolean {
  if (!scopeTenant) return false;
  const owner = norm(interaction.tenantId);
  if (owner === norm(scopeTenant.id)) return true;
  if (!scopeTenant.parentId) {
    return allTenants.some(t => t.parentId === scopeTenant.id && norm(t.id) === owner);
  }
  return false;
}

export function filterInteractionsForScope(params: {
  interactions: readonly Interaction[];
  tenants: readonly ScopeTenant[];
  scope: ScopeUser;
  /** Só o superadmin usa: tenant específico pedido na consulta. */
  requestedTenantId?: string | null;
  /** Filtro de exibição opcional (`bpoName` da query/sessão). */
  requestedBpo?: string | null;
}): Interaction[] {
  const { interactions, tenants, scope } = params;
  if (scope.role === "superadmin" && !params.requestedTenantId) return [...interactions];

  const tenantId = scope.role === "superadmin" ? String(params.requestedTenantId || "") : scope.tenantId;
  if (!tenantId || tenantId === GLOBAL_TENANT_ID) {
    // Fail-closed: apenas superadmin pode operar em system-global. Uma conta
    // legada não-superadmin nesse sentinela não enxerga a base inteira.
    return scope.role === "superadmin" ? [...interactions] : [];
  }

  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return [];

  const requested = norm(params.requestedBpo);
  const requestedActive = Boolean(requested) && requested !== "all";
  const isSubtenantScope = Boolean(tenant.parentId);

  return interactions.filter(interaction => {
    if (!interactionInScope(interaction, tenant, tenants)) return false;
    if (!requestedActive) return true;
    if (!isSubtenantScope) return norm(interaction.bpoName) === requested;
    // Sub-tenant: o filtro de exibição nunca esconde o próprio dado.
    if (norm(interaction.tenantId) === norm(tenant.id)) return true;
    return bpoAliases(tenant).has(norm(interaction.bpoName));
  });
}

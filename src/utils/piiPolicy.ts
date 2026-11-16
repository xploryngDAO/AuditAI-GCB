/**
 * Política de mascaramento de PII por tenant.
 *
 * A decisão explícita do tenant (quando existir) vence o default global do
 * conector. Sem decisão do tenant, mantém o comportamento histórico: mascarado
 * a menos que o global esteja explicitamente desligado (`!== false`).
 *
 * Função pura para poder ser testada e usada por server/UI.
 */

/** `tenantOverride` = decisão explícita do tenant (boolean) ou `undefined`. */
export function resolvePiiMaskingEnabled(tenantOverride: unknown, globalEnabled: unknown): boolean {
  if (typeof tenantOverride === "boolean") return tenantOverride;
  return globalEnabled !== false;
}

/** Extrai o override de um mapa de configs por tenant. */
export function piiMaskingOverrideForTenant(
  tenantConfigs: Record<string, any> | undefined | null,
  tenantId: string | undefined | null,
  globalTenantId = "system-global"
): boolean | undefined {
  if (!tenantConfigs || !tenantId || tenantId === globalTenantId) return undefined;
  const value = tenantConfigs[tenantId]?.piiMaskingEnabled;
  return typeof value === "boolean" ? value : undefined;
}

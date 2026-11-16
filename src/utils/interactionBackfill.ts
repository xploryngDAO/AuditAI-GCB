/**
 * Planejamento de backfill de tenancy para interações legadas.
 *
 * Problema: capturas antigas podiam ser gravadas com `tenantId` da matriz
 * (ou `system-global`/vazio) e `bpoName` do parceiro. A leitura já herda esses
 * registros de forma ancorada, mas métricas/relatórios e operações que dependem
 * do dono continuam melhores com o `tenantId` canônico.
 *
 * Regra segura e idempotente:
 * - só migra quando o `bpoName` casa com EXATAMENTE UM sub-tenant;
 * - só quando o dono atual é a matriz do sub-tenant, `system-global` ou vazio;
 * - se o dono for outra tenant, reporta conflito e NÃO altera;
 * - normaliza o rótulo para `subTenant.bpoName || subTenant.name`;
 * - casamento ambíguo (dois sub-tenants com o mesmo rótulo) não é migrado.
 *
 * Função pura para permitir dry-run, testes e execução em dump do estado.
 */

import type { Interaction, Tenant } from "../types";

export type BackfillTenant = Pick<Tenant, "id" | "name" | "parentId" | "isSubtenant" | "bpoName">;
export type BackfillInteraction = Pick<Interaction, "id" | "tenantId" | "bpoName">;

const GLOBAL_TENANT_ID = "system-global";
const norm = (value: unknown): string => String(value ?? "").trim().toLowerCase();

export type BackfillProposal = {
  interactionId: string;
  fromTenantId: string | null;
  fromBpoName: string | null;
  toTenantId: string;
  toBpoName: string;
  reason: "inherited-bpo" | "normalize-label";
};

export type BackfillAmbiguity = {
  interactionId: string;
  bpoName: string;
  candidateTenantIds: string[];
};

export type BackfillConflict = {
  interactionId: string;
  bpoName: string;
  currentTenantId: string;
};

export type BackfillPlan = {
  total: number;
  unchanged: number;
  proposals: BackfillProposal[];
  ambiguities: BackfillAmbiguity[];
  conflicts: BackfillConflict[];
};

/** Índice alias -> sub-tenants. Alias = bpoName e name do sub-tenant. */
function buildSubtenantAliasIndex(tenants: readonly BackfillTenant[]): Map<string, BackfillTenant[]> {
  const index = new Map<string, BackfillTenant[]>();
  for (const tenant of tenants) {
    if (!tenant || (!tenant.isSubtenant && !tenant.parentId)) continue;
    const seen = new Set<string>();
    for (const raw of [tenant.bpoName, tenant.name]) {
      const alias = norm(raw);
      if (!alias || seen.has(alias)) continue;
      seen.add(alias);
      const list = index.get(alias) || [];
      if (!list.some(t => t.id === tenant.id)) list.push(tenant);
      index.set(alias, list);
    }
  }
  return index;
}

export function planInteractionTenantBackfill(
  interactions: readonly BackfillInteraction[],
  tenants: readonly BackfillTenant[]
): BackfillPlan {
  const aliasIndex = buildSubtenantAliasIndex(tenants);
  const plan: BackfillPlan = {
    total: interactions.length,
    unchanged: 0,
    proposals: [],
    ambiguities: [],
    conflicts: []
  };

  for (const interaction of interactions) {
    const label = norm(interaction.bpoName);
    const matches = label ? (aliasIndex.get(label) || []) : [];
    if (matches.length === 0) {
      plan.unchanged += 1;
      continue;
    }
    if (matches.length > 1) {
      plan.ambiguities.push({
        interactionId: String(interaction.id),
        bpoName: String(interaction.bpoName ?? ""),
        candidateTenantIds: matches.map(t => t.id).sort()
      });
      continue;
    }

    const subtenant = matches[0];
    const canonicalBpo = String(subtenant.bpoName || subtenant.name || "").trim();
    const owner = norm(interaction.tenantId);
    const isOwn = owner === norm(subtenant.id);
    const isInheritable = owner === norm(subtenant.parentId) || owner === GLOBAL_TENANT_ID || owner === "";

    if (isOwn) {
      if (canonicalBpo && label !== norm(canonicalBpo)) {
        plan.proposals.push({
          interactionId: String(interaction.id),
          fromTenantId: interaction.tenantId ?? null,
          fromBpoName: interaction.bpoName ?? null,
          toTenantId: subtenant.id,
          toBpoName: canonicalBpo,
          reason: "normalize-label"
        });
      } else {
        plan.unchanged += 1;
      }
      continue;
    }

    if (isInheritable) {
      plan.proposals.push({
        interactionId: String(interaction.id),
        fromTenantId: interaction.tenantId ?? null,
        fromBpoName: interaction.bpoName ?? null,
        toTenantId: subtenant.id,
        toBpoName: canonicalBpo,
        reason: "inherited-bpo"
      });
      continue;
    }

    plan.conflicts.push({
      interactionId: String(interaction.id),
      bpoName: String(interaction.bpoName ?? ""),
      currentTenantId: String(interaction.tenantId ?? "")
    });
  }

  return plan;
}

/** Aplica as propostas em um array de interações (retorna novo array). */
export function applyInteractionBackfill<T extends BackfillInteraction>(
  interactions: readonly T[],
  plan: BackfillPlan
): T[] {
  const byId = new Map(plan.proposals.map(p => [p.interactionId, p]));
  return interactions.map(interaction => {
    const proposal = byId.get(String(interaction.id));
    if (!proposal) return interaction;
    return { ...interaction, tenantId: proposal.toTenantId, bpoName: proposal.toBpoName } as T;
  });
}

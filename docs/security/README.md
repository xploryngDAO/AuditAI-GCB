# Auditoria de segurança e LGPD — AuditaQA (nov/2026)

Relatórios completos desta rodada de auditoria, preservados como documentação do repositório.
Os documentos foram gerados em uma sessão de auditoria com três frentes independentes
(LGPD/IA, isolamento multi-tenant e visibilidade de sub-tenant/BPO) e revisão adversarial do diff.

> **Importante:** os relatórios citam linhas do snapshot em que foram produzidos e trazem a seção
> de status "corrigido / aberto". O código atual já contém as correções descritas como aplicadas.
> Riscos residuais e decisões de produto/jurídico continuam listados no fim deste README.

## Documentos

| Arquivo | Escopo |
|---|---|
| [lgpd-ia.md](lgpd-ia.md) | Egresso de dados para modelos de IA/serviços externos, mascaramento de PII, decisão por tenant, few-shot, logs e transferência internacional |
| [tenant-isolation.md](tenant-isolation.md) | Isolamento entre tenants: credenciais, IDOR, chat, deletes destrutivos, escopos admin/BPO/superadmin |
| [subtenant-visibility.md](subtenant-visibility.md) | Causa raiz do bug "sub-tenant atribuída a BPO não mostra dados atribuídos ao BPO" e correção canônica de escopo |

## Garantias implementadas nesta rodada

1. **Egresso mascarado para IA externa em todos os caminhos**: `executeAIChatCompletion`
   (14 provedores), `getEmbeddingVector`, re-auditoria, chat e contexto de auditoria passam por
   `maskExternalPrompt` antes de sair. A guarda vale mesmo que o tenant opte por armazenar o dado
   bruto (a preferência controla persistência/exibição, não o egresso externo).
2. **Política de mascaramento por tenant** (`src/utils/piiPolicy.ts`): decisão explícita do tenant
   vence o default global; escrita global restrita ao SuperAdmin SaaS.
3. **Escopo canônico de interações** (`src/utils/interactionScope.ts`): dono = `tenantId`;
   sub-tenant herda do pai/`system-global`/sem dono apenas com aliases do parceiro BPO e ancorada
   na cadeia `parentId` — sem vazamento entre matrizes.
4. **Escopo global do SaaS Master** (`src/utils/userScope.ts`) e bloqueio de sequestro de conta
   em `/api/users`.
5. **Documento binário para IA externa**: PDF/imagem agora exige consentimento explícito no
   formulário (`consentExternalAi`) e o consentimento (e-mail, data, arquivo) é registrado em
   `tenantAiConfigsDb[tenantId].documentAiConsents` (máx. 50 entradas). Sem consentimento,
   cai no fallback local e não chama provedor externo.
6. **Few-shot sem PII real**: exemplos padrão usam placeholders; migração no boot mascara PII que
   tenha ficado persistida em instalações antigas.

## Backfill de dados legados

Capturas antigas podem ter `tenantId` da matriz/`system-global`/vazio com `bpoName` do parceiro.
A leitura já é correta (herança ancorada), mas métricas e operações por dono melhoram com o
`tenantId` canônico. Use o script idempotente:

```bash
# dry-run (padrão) — não altera nada
npm run backfill:interactions -- --file database_store.json

# aplicar com backup automático ao lado do arquivo
npm run backfill:interactions -- --file database_store.json --write

# dump do Neon: SELECT state FROM platform_state; salve em JSON e passe --file
npm run backfill:interactions -- --file platform_state.json --report backfill-report.json
```

Regras: só migra quando o `bpoName` casa com **exatamente um** sub-tenant; só quando o dono é a
matriz do sub-tenant, `system-global` ou vazio; conflitos (outra tenant) e ambiguidades nunca são
alterados. O script é idempotente.

## Riscos residuais / decisões pendentes

1. **Anonimização completa**: `maskPII` é mascaramento por padrões (CPF/CNPJ, contato, nomes em
   tags/falas explícitas/linhas `Cliente:`); nomes em texto livre/JSON e nomes de atendentes ainda
   podem escapar. Para "nunca PII", o próximo nível é pseudonimização com vault/NER ou anonimização
   contratual no provedor.
2. **Transferência internacional e operadores**: 14 provedores de IA (incluindo China), Neon e Vercel.
   Faltam ROPA, RIPD, DPA/SCC, registro de transferência e inventário de retenção.
3. **Retenção/DSAR/erasure automatizados** não implementados; transcrições e chats ficam no
   documento `platform_state`/`interactions` sem TTL nem fluxo de exclusão por titular.
4. **Toggles de PII** de Twilio/Amazon/Avaya/Cisco são campos mortos; só Genesys/Zendesk têm
   endpoints efetivos. Consolidar em painel único por tenant.
5. **Monitorias tradicionais** não possuem `tenantId`; a visão BPO é somente leitura (decisão de
   produto).
6. **Health/diagnóstico** de integrações é ilustrativo: agora marcado como `simulated: true` na
   resposta; não há sonda remota real.

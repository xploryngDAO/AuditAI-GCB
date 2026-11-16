# Migração para arquitetura híbrida (Opção B) — Estágio 3

> Documento de planejamento. Nada deste plano foi aplicado ainda.
> Contexto: limpeza de produção concluída em 12/11/2026 (`platform_state` versão 832, 1 superadmin, 0 tenants, 0 atendimentos, 0 chats, metodologia zerada, 7 conectores preservados sem credenciais).

## 1. Objetivo

Sair do modelo **documento único** (`platform_state.state` com todo o estado da plataforma) para uma arquitetura **híbrida**:

- **PostgreSQL relacional** para dados de volume, integridade e isolamento: tenants, usuários, vínculos, atendimentos, transcrições, credenciais de integração, auditoria.
- **JSONB por escopo** para configurações flexíveis: metodologia, preferências de IA, mapeamentos de integração.
- **Object storage** (S3/R2) para transcrições longas e áudio, quando o volume justificar.
- **RLS + FKs + índices + migrações versionadas + trilha de auditoria** como base de segurança/LGPD.
- `platform_state` passa a ser **legado somente leitura** durante a transição e depois é arquivado.

## 2. Evidências que motivam a mudança

| Sintoma | Evidência (produção antes da limpeza) |
|---|---|
| Documento único reescrito a cada mutação | 652.893 caracteres, jsonb 270 KB, tabela 5,1 MB, 831 versões |
| Sem modelo relacional para atendimentos | 48 atendimentos dentro do JSON; leitura/filtro em memória; ~6,7 KB por atendimento |
| Espelho inconsistente | tabela `interactions` com 275 linhas × 48 no documento (exclusões nunca propagadas) |
| Credenciais em texto no JSON | 8 segredos Genesys + 2 chaves de IA no documento |
| Isolamento só na aplicação | sem RLS, sem FKs, `tenants`/`app_users` sem integridade referencial |
| Sem migrações/auditoria | DDL no boot; `stateVersion` global; sem `updated_at` por entidade; sem trilha de exclusões |
| Ambientes compartilhados | mesma `DATABASE_URL` para production/preview/development |

## 3. Arquitetura-alvo

```
Cliente → Vercel Function (API) ──► Neon Postgres (pooled)
                                   ├─ tenants / users / memberships
                                   ├─ interactions ─► interaction_transcripts
                                   ├─ integration_catalog / integration_tenant_configs (credenciais cifradas)
                                   ├─ config_scopes (JSONB por tenant/global: metodologia, IA)
                                   ├─ audit_log (append-only)
                                   └─ schema_migrations (versionado)
                    └──────────────► Object Storage (S3/R2) — áudio/transcrições grandes
```

## 4. Modelo de dados alvo (fase 2/3)

### 4.1 Núcleo de tenancy (normalizado, RLS)

- `tenants` — `id uuid pk`, `parent_id uuid fk tenants(id)`, `name`, `slug unique`, `cnpj`, `plan`, `active`, `created_at`, `updated_at`, `deleted_at`.
- `users` — `id uuid pk`, `email citext unique`, `password_hash`, `is_superadmin bool`, `created_at`, `updated_at`, `deleted_at`.
- `memberships` — `(user_id, tenant_id) pk`, `role` (`admin`|`bpo`), `bpo_name`, `created_at`.
- Regra: SaaS Super = `users.is_superadmin`, sem vínculo de tenant (substitui `tenantId='system-global'`).

### 4.2 Atendimentos

- `interactions` — `id uuid pk`, `tenant_id fk`, `external_id`, `channel` enum(`audio`,`chat`), `bpo_name`, `agent_name`, `customer_name_masked`, `occurred_at timestamptz`, `duration_seconds`, `silence_seconds`, `score smallint`, `csat numeric`, `sentiment text`, `script_adherence smallint`, `audit_status text`, `audio_url`, `pii_masked bool`, `evaluation jsonb`, `created_at`, `updated_at`.
  - Índices: `(tenant_id, occurred_at desc)`, `(tenant_id, audit_status)`, `(tenant_id, bpo_name)`, `(tenant_id, agent_name)`, GIN em `evaluation` se necessário.
- `interaction_transcripts` — `interaction_id pk fk`, `transcript text`, `raw_transcript text`, `masked bool`, `storage_key text` (fase 3: conteúdo no object storage).
- Retenção por política (`retention_until`), exclusão em cascata com registro em `audit_log`.

### 4.3 Configurações (JSONB por escopo)

- `config_scopes` — `id`, `scope` (`global`|`tenant`), `tenant_id nullable`, `methodology jsonb`, `ai jsonb`, `updated_at`, `version`.
  - Metodologia no JSONB: `{ weights, expectedScript, criticalDeviations, bookContent, fewShotPrompt, useEmbeddings, bloques[], guiaItens[] }`.
  - Justificativa: baixo volume, altíssima flexibilidade e já validada no produto; deixa de ser uma linha **única global**.
- Opcional (fase 3): normalizar `methodology_blocks` e `guia_itens` se houver necessidade de relatórios/joins por item.

### 4.4 Integrações

- `integration_catalog` — definições dos conectores (id text pk, name, vendor, type, auth_type, version, fields jsonb, master_enabled). **É o que preservamos da "Hub".**
- `integration_tenant_configs` — `(integration_id, tenant_id, bpo_name)` pk, `config jsonb`, `credentials_encrypted bytea` (pgp_sym_encrypt/KMS), `updated_at`.
  - Credenciais **nunca** em coluna jsonb legível; decriptação só no servidor, com chave em secret manager/KMS.
- `integration_runs` — logs de captura recorrente (substitui `*RecurringConfigDb.logs`).

### 4.5 Auditoria e migração

- `audit_log` — `id bigserial`, `tenant_id`, `actor_user_id`, `actor_email`, `action`, `entity_type`, `entity_id`, `diff jsonb`, `request_id`, `created_at`; append-only; opcional hash-chain para imutabilidade.
- `schema_migrations` — `version`, `checksum`, `applied_at`.
- `platform_state_archive` — snapshot JSON final do legado (para lixo/retrospectiva), sem leitura no runtime.

## 5. Fases de execução

### Fase 0 — Pré-requisitos (1–2 dias)
- **Branch Neon dedicado por ambiente** (production/preview/development) e remoção da `DATABASE_URL` compartilhada.
- Backup/PITR validado + ensaio de restauração em branch separado.
- Ferramenta de migrações (Drizzle ou Prisma) + pipeline CI (`typecheck`, testes, migrate dry-run).
- Criar roles: `app_rw`, `app_ro`, `migrator`; RLS habilitado por padrão.
- Remover `SETUP_TOKEN` de produção após provisionamento definitivo.
- Feature flag `STAGE3_DUAL_WRITE` por tenant/escopo.

### Fase 1 — Schema novo (2–4 dias)
- Aplicar DDL (Anexo A) em branch de staging.
- Tabelas novas convivem com `platform_state`; nenhuma leitura muda ainda.
- Testes de integridade: constraints, FKs, índices, policies RLS.

### Fase 2 — Dual-write (3–5 dias)
- Escritas do app passam a gravar **nas duas estruturas** (feature flag):
  - tenants/users/memberships;
  - interactions/transcripts;
  - config_scopes (methodology/ai);
  - integration_catalog + integration_tenant_configs (credenciais cifradas);
  - audit_log.
- Escritas continuam no documento como fallback; conflitos de versão resolvidos pelo guard atual.
- Testes de paridade: contagem + digest por tenant entre documento e tabelas.

### Fase 3 — Backfill (2–3 dias)
- Script idempotente doc→tabelas para tenants, users, interactions, configs, integrações.
- Verificação de paridade (contagens, campos normalizados, hash por tenant).
- Reexecutável; não apaga nada no documento.

### Fase 4 — Cutover de leitura (3–5 dias)
- Leituras passam a vir das tabelas (por tenant, com rollback por flag).
- `/api/interactions` com paginação e filtros no banco (nunca carregar o documento).
- `/api/config` lê `config_scopes`.
- Rollback: flag desliga leitura nova e volta ao documento (dados não são perdidos — dual-write ativo).

### Fase 5 — Encerramento do legado (2–4 dias)
- Desligar dual-write; documento vira snapshot somente leitura (`platform_state_archive`).
- Remover espelhos antigos (`tenants`, `app_users`, `interactions`) depois de migrar leituras.
- Remover `chatsDb`/`monitorias` do documento migrando para tabelas próprias se necessário.
- Limpeza de código morto e fallbacks de seed.

### Fase 6 — Object storage e hardening (1–2 semanas)
- Transcrições/áudio em S3/R2 com criptografia, URLs assinadas e lifecycle.
- Criptografia de credenciais com KMS; rotação de chaves.
- RLS completo por tenant + testes de isolamento automatizados.
- Retenção/erasure (LGPD) com trilha em `audit_log`.

## 6. Critérios de sucesso

- Nenhuma reescrita de documento por mutação (documento ≤ configurações).
- p95 de leitura de atendimentos < 300 ms com 10 mil registros.
- Paridade 100% documento ↔ tabelas durante dual-write.
- Zero credenciais em texto claro no banco.
- `tenantStore.inSync` substituído por testes de RLS por tenant.
- Restauração de branch validada em < 1 h.

## 7. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Perda de dados no cutover | dual-write + backfill idempotente + snapshot final + branch Neon |
| Conflito entre instâncias serverless | versão por tenant/entidade + transações + outbox |
| Divergência documento × tabelas | job de paridade a cada hora + alarme |
| Vazamento entre tenants | RLS + testes automatizados + revisão de policies |
| Credenciais | KMS/pgsodium + secret manager + rotação |
| Custo/performance | driver pooled para transações; índices medidos com EXPLAIN |

## 8. Cronograma sugerido (equipe pequena)

1. Fase 0–1: 1 semana
2. Fase 2: 1 semana
3. Fase 3: 1 semana
4. Fase 4: 1 semana
5. Fase 5–6: 2–3 semanas

Total: **6–8 semanas** com um engenheiro, sem parar a operação.

## Anexo A — DDL inicial (draft)

```sql
create extension if not exists citext;
create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references tenants(id),
  name text not null,
  slug citext unique,
  cnpj text,
  plan text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table memberships (
  user_id uuid references users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  role text not null check (role in ('admin','bpo')),
  bpo_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  external_id text,
  channel text not null check (channel in ('audio','chat')),
  bpo_name text,
  agent_name text,
  customer_name_masked text,
  occurred_at timestamptz,
  duration_seconds int,
  silence_seconds int,
  score smallint,
  csat numeric(3,2),
  sentiment text,
  script_adherence smallint,
  audit_status text not null default 'pending',
  audio_url text,
  pii_masked boolean not null default false,
  evaluation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interactions_tenant_date_idx on interactions (tenant_id, occurred_at desc);
create index interactions_tenant_status_idx on interactions (tenant_id, audit_status);
create unique index interactions_tenant_external_idx on interactions (tenant_id, external_id) where external_id is not null;

create table interaction_transcripts (
  interaction_id uuid primary key references interactions(id) on delete cascade,
  transcript text,
  raw_transcript text,
  masked boolean not null default true,
  storage_key text
);

create table config_scopes (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global','tenant')),
  tenant_id uuid references tenants(id) on delete cascade,
  methodology jsonb not null default '{}'::jsonb,
  ai jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (scope, tenant_id)
);

create table integration_catalog (
  id text primary key,
  name text not null,
  vendor text,
  type text,
  auth_type text,
  version text,
  master_enabled boolean not null default true,
  fields jsonb not null default '[]'::jsonb
);

create table integration_tenant_configs (
  integration_id text references integration_catalog(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  bpo_name text not null default '',
  config jsonb not null default '{}'::jsonb,
  credentials_encrypted bytea,
  updated_at timestamptz not null default now(),
  primary key (integration_id, tenant_id, bpo_name)
);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid,
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  diff jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
```

## Anexo B — Mapeamento documento → tabelas

| Documento (legado) | Destino |
|---|---|
| `tenantsDb[]` | `tenants` (+ `memberships` pelo adminEmail) |
| `usersDb[]` | `users` + `memberships` |
| `bposDb[]` | derivado de `tenants.is_subtenant` + `memberships.bpo_name` |
| `interactionsDb[]` | `interactions` + `interaction_transcripts` |
| `monitoriasTradicionaisDb[]` | tabela `traditional_monitorias` (fase 3) |
| `chatsDb[]` | `chats`/`chat_messages` (fase 3) |
| `auditConfigDb` | `config_scopes` (scope=global, methodology) |
| `tenantAiConfigsDb[tenant]` | `config_scopes` (scope=tenant, methodology+ai) |
| `systemsIntegrationsDb[]` | `integration_catalog` (+ `integration_tenant_configs`) |
| `*RecurringConfigDb` | `integration_runs` + `integration_tenant_configs` |
| `universalWebhookConfigDb` | `integration_tenant_configs` (custom_webhook) |

## Anexo C — Runbook de rollout e rollback

**Rollout por tenant:** flag leitura nova → 1 tenant interno → validar paridade → 10% → 100%.
**Rollback:** desligar flag (`STAGE3_READ=document`) → app volta ao documento; dual-write permanece até validação. Se necessário, restaurar branch Neon do momento anterior ao cutover.
**Incidente:** pausar dual-write, congelar escritas (modo manutenção), comparar contagens/digests, corrigir e retomar.

## Status de execução

### 12/11/2026 — Produção preparada (Fase 0 parcial)
- `platform_state` version 832: 1 superadmin (`<e-mail do superadmin>`), 0 tenants, 0 atendimentos, 0 chats, metodologia zerada.
- Espelhos executados: `tenants` 0, `app_users` 1, `interactions` 0 (limpeza dos 275 órfãos).
- Backup lógico completo em `.scratch/backups/prod-2026-11-12T12-45-50-337Z/` (state + tabelas + hashes).
- Deploy da versão corrigida (`dpl` novo, alias `auditai-dev.vercel.app`) com smoke de leitura e escrita (criar/excluir conversa) OK.

### 12/11/2026 — Fase 0/1 iniciada (schema versionado)
- `db/schema.ts` com 9 tabelas (tenants, users, memberships, interactions, interaction_transcripts, config_scopes, integration_catalog, integration_tenant_configs, audit_log).
- Migrações: `0000_stage3_init.sql` (tabelas/FKs/índices) e `0001_rls_policies.sql` (roles `app_rw`/`app_ro`, RLS por tenant, constraints, triggers, auditoria append-only).
- Tooling: `drizzle-kit` + `pg`; scripts `db:generate`, `db:migrate`, `db:verify` e `smoke:prod`.
- Validação local em Postgres 16 (Docker): migrações aplicadas 2× (idempotentes), 9 tabelas, 9 policies, RLS habilitado e **teste de isolamento por tenant aprovado**.
- Pendente: apontar `STAGE3_DATABASE_URL` para o branch Neon de staging (configuração do usuário), job de CI com banco efêmero e início do dual-write (Fase 2).

### 12/11/2026 — Fase 0 concluída (staging no Neon + higiene)
- Banco de staging criado no Neon: **database `auditai_stage3`** (mesmo projeto/branch, database separado do `neondb` de produção) — `STAGE3_DATABASE_URL` no `.env` local (gitignored, também guardado no cofre local).
- Migrações `0000`, `0001` e `0002` aplicadas no Neon staging; `db:verify` aprovado (9 tabelas, 9 policies, RLS habilitado, isolamento por tenant e roles `app_rw`/`app_ro`).
- **SETUP_TOKEN removido do ambiente Production** na Vercel (confirmado via `/api/health`: `setupEnabled=false`); resta apenas em Preview.
- Cofre local criptografado criado (`vault/`, AES-256-GCM) com os backups/segredos pré-limpeza e do staging; originais em texto puro removidos do disco.
- Deploy final + validação E2E em produção (19/19): criar tenant, login do admin do tenant, escrita de chat e metodologia, isolamento de usuários, exclusão e retorno ao estado limpo (`stateVersion` 842).
- Limpeza pós-E2E: órfãos de configs (`tenantAiConfigsDb` e `tenantConfigs` do tenant temporário) removidos com guarda de versão; espelhos sincronizados — `stateVersion` 843, `tenants 0 / app_users 1 / interactions 0`.
- `vault/` adicionado ao `.gitignore` e `.vercelignore` (nunca vai para o repositório nem para a Vercel).
- Pendente: separar `DATABASE_URL` por ambiente em branches Neon, job de CI com Postgres efêmero (GitHub Actions), remover `SETUP_TOKEN` do Preview e iniciar a Fase 2 (dual-write).



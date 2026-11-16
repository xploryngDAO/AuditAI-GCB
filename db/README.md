# Estágio 3 — banco híbrido (schema e migrações)

Este diretório contém o schema versionado da arquitetura híbrida (Opção B). **Nada aqui é usado pelo runtime atual** — a virada de leitura acontece na Fase 4 do plano em [docs/migracao-hibrida-estagio3.md](../docs/migracao-hibrida-estagio3.md).

## Estrutura

```
db/
  schema.ts                 # tabelas (drizzle-orm/pg-core)
  migrations/
    0000_stage3_init.sql     # tabelas, FKs, índices
    0001_rls_policies.sql    # roles, RLS, constraints, triggers, grants
drizzle.config.ts            # dialect postgresql + STAGE3_DATABASE_URL
scripts/db-verify.mjs        # valida tabelas, policies, RLS e isolamento por tenant
```

## Requisitos

- Um **branch/banco de staging no Neon** dedicado (nunca produção, nunca preview).
- `STAGE3_DATABASE_URL` apontando para ele.
- Node 24+.

## Comandos

```bash
# gerar migração depois de alterar db/schema.ts
npm run db:generate -- --name=minha_alteracao

# aplicar migrações no banco de staging
STAGE3_DATABASE_URL="postgresql://..." npm run db:migrate

# validar schema, RLS, roles e isolamento por tenant
STAGE3_DATABASE_URL="postgresql://..." npm run db:verify
```

Validação local com Docker (usei na Fase 0/1):

```bash
docker run -d --name auditai-stage3-pg -e POSTGRES_PASSWORD=stage3 -e POSTGRES_DB=auditai_stage3 -p 55433:5432 postgres:16-alpine
STAGE3_DATABASE_URL="postgresql://postgres:stage3@127.0.0.1:55433/auditai_stage3" npm run db:migrate
STAGE3_DATABASE_URL="postgresql://postgres:stage3@127.0.0.1:55433/auditai_stage3" npm run db:verify
```

## Contrato de RLS para o runtime (Fase 2+)

Cada requisição/transação deve definir o contexto **antes** de consultar:

```sql
select set_config('app.tenant_id', '<uuid-da-tenant>', true);
select set_config('app.user_id', '<uuid-do-usuario>', true);
select set_config('app.is_superadmin', 'on' | 'off', true); -- superadmin enxerga tudo
```

Regras aplicadas no banco:

- `tenants`: tenant atual + seus sub-tenants; superadmin vê tudo.
- `memberships`, `interactions`, `interaction_transcripts`, `integration_tenant_configs`: escopo por tenant.
- `config_scopes`: global (`tenant_id null`) ou da tenant; escrita só no próprio escopo.
- `users`: própria conta, usuários da tenant atual, ou superadmin.
- `audit_log`: append-only — `app_rw` tem SELECT/INSERT e **não** tem policy de UPDATE/DELETE (negado pelo RLS).
- `app_ro`: somente leitura (BI/relatórios).
- `integration_catalog`: catálogo global de conectores, sem RLS (referência gerenciada por migração).

## Regras de segurança

1. Nunca aponte `STAGE3_DATABASE_URL` para produção; o deploy usa `DATABASE_URL`.
2. Credenciais de integração vão em `integration_tenant_configs.credentials_encrypted` (ciphertext base64), **nunca** em `config` jsonb.
3. Migrações são versionadas (`db/migrations`) e aplicadas apenas em staging até a Fase 4.
4. Antes de qualquer migração: branch/snapshot no Neon + `npm run db:verify` + revisão do SQL gerado.
5. Rollback de schema: migração inversa revisada + restore do branch Neon (não usar `db:push`).

## Status (Fase 0/1 — concluída em 12/11/2026)

- [x] Drizzle ORM + drizzle-kit + `pg` instalados (`db:migrate`, `db:verify`).
- [x] 9 tabelas com FKs, índices e constraints saneados.
- [x] Roles `app_rw`/`app_ro`, RLS por tenant e auditoria append-only.
- [x] Migrações aplicadas em Postgres 16 local (idempotentes) e validação de isolamento por tenant.
- [x] Banco de staging no Neon criado (`auditai_stage3`, database separado do `neondb`) e migrações `0000`–`0002` aplicadas + `db:verify` aprovado.
- [x] Job `db-schema` no CI (Postgres 16 efêmero): aplica migrações e roda `db:verify` em cada push/PR.
- [ ] Separar também `DATABASE_URL` por ambiente em branches Neon (hoje production/preview/development compartilham a mesma URL).
- [ ] Iniciar Fase 2 (dual-write + feature flags).

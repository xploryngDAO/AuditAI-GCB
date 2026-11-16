-- Estágio 3 — segurança e integridade (RLS, roles, constraints e triggers).
-- Aplicado depois da migração de tabelas (0000_stage3_init.sql).

create extension if not exists pgcrypto;

-- Roles da aplicação: o runtime usa app_rw; relatórios/BI usam app_ro.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_rw') then
    create role app_rw nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_ro') then
    create role app_ro nologin;
  end if;
end $$;

grant usage on schema public to app_rw, app_ro;
grant select on all tables in schema public to app_ro;
grant select, insert, update, delete on all tables in schema public to app_rw;
grant usage, select on all sequences in schema public to app_rw;

-- Contexto por requisição (definido pelo app: set_config('app.tenant_id', ..., true)):
create or replace function app_current_tenant() returns uuid
language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app_current_user() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function app_is_superadmin() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.is_superadmin', true), 'off') = 'on'
$$;

-- updated_at automático
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tenants_set_updated_at before update on tenants for each row execute function set_updated_at();
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();
create trigger interactions_set_updated_at before update on interactions for each row execute function set_updated_at();
create trigger config_scopes_set_updated_at before update on config_scopes for each row execute function set_updated_at();
create trigger integration_tenant_configs_set_updated_at before update on integration_tenant_configs for each row execute function set_updated_at();

-- Constraints de domínio
alter table memberships add constraint memberships_role_check check (role in ('admin', 'bpo'));
alter table interactions add constraint interactions_channel_check check (channel in ('audio', 'chat'));
alter table interactions add constraint interactions_audit_status_check check (audit_status in ('pending', 'completed', 'failed'));
alter table config_scopes add constraint config_scopes_scope_check check (scope in ('global', 'tenant'));
alter table config_scopes add constraint config_scopes_tenant_required check (
  (scope = 'global' and tenant_id is null) or (scope = 'tenant' and tenant_id is not null)
);

-- Row Level Security por tenant
alter table tenants enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table interactions enable row level security;
alter table interaction_transcripts enable row level security;
alter table config_scopes enable row level security;
alter table integration_tenant_configs enable row level security;
alter table audit_log enable row level security;

-- tenants: a matriz enxerga os filhos; superadmin enxerga tudo.
create policy tenants_scope on tenants
  using (app_is_superadmin() or id = app_current_tenant() or parent_id = app_current_tenant())
  with check (app_is_superadmin() or id = app_current_tenant());

-- users: própria conta, usuários da tenant atual, ou superadmin.
create policy users_scope on users
  using (
    app_is_superadmin()
    or id = app_current_user()
    or exists (
      select 1 from memberships m
      where m.user_id = users.id and m.tenant_id = app_current_tenant()
    )
  )
  with check (app_is_superadmin() or id = app_current_user());

create policy memberships_scope on memberships
  using (app_is_superadmin() or tenant_id = app_current_tenant() or user_id = app_current_user())
  with check (app_is_superadmin() or tenant_id = app_current_tenant());

create policy interactions_scope on interactions
  using (app_is_superadmin() or tenant_id = app_current_tenant())
  with check (app_is_superadmin() or tenant_id = app_current_tenant());

create policy interaction_transcripts_scope on interaction_transcripts
  using (
    app_is_superadmin()
    or exists (select 1 from interactions i where i.id = interaction_transcripts.interaction_id and i.tenant_id = app_current_tenant())
  )
  with check (
    app_is_superadmin()
    or exists (select 1 from interactions i where i.id = interaction_transcripts.interaction_id and i.tenant_id = app_current_tenant())
  );

create policy config_scopes_scope on config_scopes
  using (app_is_superadmin() or tenant_id is null or tenant_id = app_current_tenant())
  with check (app_is_superadmin() or tenant_id = app_current_tenant());

create policy integration_tenant_configs_scope on integration_tenant_configs
  using (app_is_superadmin() or tenant_id = app_current_tenant())
  with check (app_is_superadmin() or tenant_id = app_current_tenant());

-- auditoria é append-only: sem policy de update/delete = negado para app_rw.
create policy audit_log_select on audit_log
  for select using (app_is_superadmin() or tenant_id is null or tenant_id = app_current_tenant());

create policy audit_log_insert on audit_log
  for insert with check (app_is_superadmin() or tenant_id = app_current_tenant());

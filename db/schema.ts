import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Schema do Estágio 3 (arquitetura híbrida).
 * Migrações versionadas ficam em db/migrations e são aplicadas com drizzle-kit.
 * Nada aqui é usado pelo runtime atual (server.ts) — a virada de leitura acontece na Fase 4.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => tenants.id),
    name: text('name').notNull(),
    slug: text('slug'),
    cnpj: text('cnpj'),
    plan: text('plan'),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(t.slug),
    parentIdx: index('tenants_parent_idx').on(t.parentId),
  })
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    isSuperadmin: boolean('is_superadmin').notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
  })
);

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    bpoName: text('bpo_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tenantId] }),
    tenantIdx: index('memberships_tenant_idx').on(t.tenantId),
  })
);

export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    channel: text('channel').notNull(),
    bpoName: text('bpo_name'),
    agentName: text('agent_name'),
    customerNameMasked: text('customer_name_masked'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    silenceSeconds: integer('silence_seconds'),
    score: smallint('score'),
    csat: numeric('csat', { precision: 3, scale: 2 }),
    sentiment: text('sentiment'),
    scriptAdherence: smallint('script_adherence'),
    auditStatus: text('audit_status').notNull().default('pending'),
    audioUrl: text('audio_url'),
    piiMasked: boolean('pii_masked').notNull().default(true),
    evaluation: jsonb('evaluation').notNull().default({}),
    ...timestamps,
  },
  (t) => ({
    tenantDateIdx: index('interactions_tenant_date_idx').on(t.tenantId, t.occurredAt.desc()),
    tenantStatusIdx: index('interactions_tenant_status_idx').on(t.tenantId, t.auditStatus),
    tenantExternalIdx: uniqueIndex('interactions_tenant_external_idx')
      .on(t.tenantId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  })
);

export const interactionTranscripts = pgTable('interaction_transcripts', {
  interactionId: uuid('interaction_id')
    .primaryKey()
    .references(() => interactions.id, { onDelete: 'cascade' }),
  transcript: text('transcript'),
  rawTranscript: text('raw_transcript'),
  masked: boolean('masked').notNull().default(true),
  storageKey: text('storage_key'),
});

export const configScopes = pgTable(
  'config_scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    methodology: jsonb('methodology').notNull().default({}),
    ai: jsonb('ai').notNull().default({}),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantScopeIdx: uniqueIndex('config_scopes_tenant_idx')
      .on(t.tenantId)
      .where(sql`${t.scope} = 'tenant'`),
    globalScopeIdx: uniqueIndex('config_scopes_global_idx')
      .on(sql`(${t.scope})`)
      .where(sql`${t.scope} = 'global'`),
    scopeCheck: index('config_scopes_scope_idx').on(t.scope),
  })
);

export const integrationCatalog = pgTable('integration_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  vendor: text('vendor'),
  type: text('type'),
  authType: text('auth_type'),
  version: text('version'),
  masterEnabled: boolean('master_enabled').notNull().default(true),
  fields: jsonb('fields').notNull().default([]),
});

export const integrationTenantConfigs = pgTable(
  'integration_tenant_configs',
  {
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrationCatalog.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bpoName: text('bpo_name').notNull().default(''),
    config: jsonb('config').notNull().default({}),
    // Base64 do ciphertext (pgp_sym_encrypt/KMS). Nunca armazenar credencial em texto claro.
    credentialsEncrypted: text('credentials_encrypted'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.integrationId, t.tenantId, t.bpoName] }),
    tenantIdx: index('integration_tenant_configs_tenant_idx').on(t.tenantId),
  })
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id'),
    actorUserId: uuid('actor_user_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    diff: jsonb('diff'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('audit_log_tenant_created_idx').on(t.tenantId, t.createdAt.desc()),
  })
);

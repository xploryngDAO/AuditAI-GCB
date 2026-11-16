import { defineConfig } from 'drizzle-kit';

const url = process.env.STAGE3_DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  strict: true,
  verbose: true,
  dbCredentials: url ? { url } : { url: 'postgresql://postgres:stage3@127.0.0.1:55433/auditai_stage3' },
});

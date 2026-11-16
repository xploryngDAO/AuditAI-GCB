#!/usr/bin/env node
/**
 * Sobe o bundle de producao (`dist/server.cjs`) SEMPRE com NODE_ENV=production.
 *
 * `npm start` executa o bundle diretamente e depende de NODE_ENV estar no
 * ambiente. Como o `.env` local usa NODE_ENV="development" (para o
 * `npm run dev` subir o middleware Vite), rodar `npm start` sem cuidado faria
 * o servidor entrar no ramo de desenvolvimento. Este script garante o modo
 * producao usado pelo INSTALAR.bat e INICIAR.bat.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = resolve(root, 'dist', 'server.cjs');

if (!existsSync(bundle)) {
  console.error('[start:prod] dist/server.cjs nao encontrado. Rode `npm run build` (ou INSTALAR.bat) primeiro.');
  process.exit(1);
}

process.env.NODE_ENV = 'production';
createRequire(import.meta.url)(bundle);

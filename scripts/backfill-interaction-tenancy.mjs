#!/usr/bin/env node
/**
 * Backfill idempotente de tenancy para interações legadas.
 *
 * Uso:
 *   node scripts/backfill-interaction-tenancy.mjs --file database_store.json
 *   node scripts/backfill-interaction-tenancy.mjs --file database_store.json --write
 *   node scripts/backfill-interaction-tenancy.mjs --file platform_state.json --report backfill-report.json
 *
 * Funciona com:
 *   - o espelho local `database_store.json` (interactionsDb/tenantsDb); ou
 *   - um dump do estado remoto: `SELECT state FROM platform_state` exportado em JSON
 *     (formato { "state": { "interactionsDb": [...], "tenantsDb": [...] } }).
 *
 * Segurança: por padrão é DRY-RUN. Só altera o arquivo com `--write`, e antes
 * cria um backup `.backup-<timestamp>.json` ao lado do original.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyInteractionBackfill,
  planInteractionTenantBackfill
} from "../src/utils/interactionBackfill.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(`Uso:
  node scripts/backfill-interaction-tenancy.mjs [--file <estado.json>] [--write] [--report <saida.json>]

Sem --write: apenas relatório (dry-run). Com --write: aplica os ajustes com backup.
Conflitos (dono de outra tenant) e ambiguidades (rótulo duplicado) nunca são alterados.`);
  process.exit(0);
}

const file = path.resolve(root, typeof args.file === "string" ? args.file : "database_store.json");
if (!fs.existsSync(file)) {
  console.error(`Arquivo não encontrado: ${file}`);
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(`JSON inválido em ${file}: ${error.message}`);
  process.exit(2);
}

// Aceita tanto o documento direto quanto { state: <documento> } (dump do Neon).
const document = parsed && typeof parsed.state === "object" && parsed.state !== null ? parsed.state : parsed;
const interactions = Array.isArray(document?.interactionsDb) ? document.interactionsDb : null;
const tenants = Array.isArray(document?.tenantsDb) ? document.tenantsDb : null;
if (!interactions || !tenants) {
  console.error("Estrutura inesperada: o arquivo precisa conter interactionsDb[] e tenantsDb[].");
  process.exit(2);
}

const plan = planInteractionTenantBackfill(interactions, tenants);

console.log("=== Backfill de tenancy de interações (dry-run por padrão) ===");
console.log(`Arquivo        : ${file}`);
console.log(`Interações     : ${plan.total}`);
console.log(`Propostas      : ${plan.proposals.length} (${plan.proposals.filter(p => p.reason === "inherited-bpo").length} herança/BPO, ${plan.proposals.filter(p => p.reason === "normalize-label").length} normalização de rótulo)`);
console.log(`Ambiguidades   : ${plan.ambiguities.length}`);
console.log(`Conflitos      : ${plan.conflicts.length} (outra tenant — não alterados)`);
console.log(`Inalteradas    : ${plan.unchanged}`);

const preview = plan.proposals.slice(0, 30);
if (preview.length > 0) {
  console.log("\nPrévia das propostas:");
  for (const proposal of preview) {
    console.log(`  ${proposal.interactionId}: ${proposal.fromTenantId ?? "<vazio>"}/${proposal.fromBpoName ?? "<vazio>"} -> ${proposal.toTenantId}/${proposal.toBpoName} [${proposal.reason}]`);
  }
  if (plan.proposals.length > preview.length) {
    console.log(`  ... (+${plan.proposals.length - preview.length} propostas)`);
  }
}

if (plan.ambiguities.length > 0) {
  console.log("\nAmbiguidades (revisar manualmente):");
  for (const item of plan.ambiguities.slice(0, 20)) {
    console.log(`  ${item.interactionId}: rótulo "${item.bpoName}" casa com ${item.candidateTenantIds.join(", ")}`);
  }
}

if (plan.conflicts.length > 0) {
  console.log("\nConflitos (registro pertence a outra tenant; ignorado):");
  for (const item of plan.conflicts.slice(0, 20)) {
    console.log(`  ${item.interactionId}: dono=${item.currentTenantId || "<vazio>"} rótulo="${item.bpoName}"`);
  }
}

if (typeof args.report === "string") {
  const reportPath = path.resolve(root, args.report);
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), file, plan }, null, 2));
  console.log(`\nRelatório gravado em ${reportPath}`);
}

if (!args.write) {
  console.log("\nDry-run: nenhum arquivo foi alterado. Use --write para aplicar.");
  process.exit(0);
}

const applied = applyInteractionBackfill(interactions, plan);
document.interactionsDb = applied;

const backupPath = `${file}.backup-${Date.now()}.json`;
fs.copyFileSync(file, backupPath);
const tmpPath = `${file}.tmp`;
fs.writeFileSync(tmpPath, JSON.stringify(parsed, null, 2));
fs.renameSync(tmpPath, file);

console.log(`\nAplicado: ${plan.proposals.length} interação(ões) atualizada(s).`);
console.log(`Backup: ${backupPath}`);

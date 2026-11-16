#!/usr/bin/env node
/**
 * Abre o navegador quando o servidor local do AuditAI GCB estiver pronto.
 *
 * Aguarda `GET /api/health` responder 200 e abre a URL no navegador padrao.
 * Usado pelo INSTALAR.bat/INICIAR.bat para nao depender de tempo fixo de boot.
 * Desiste apos AUDITAI_GCB_BROWSER_TIMEOUT_MS (padrao 180s).
 */
import { spawn } from 'node:child_process';

const baseUrl = String(
  process.env.AUDITAI_GCB_URL ||
    `http://localhost:${process.env.PORT || 3000}`
).replace(/\/+$/, '');
const timeoutMs = Number(process.env.AUDITAI_GCB_BROWSER_TIMEOUT_MS || 180_000);
const deadline = Date.now() + (Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180_000);

function openBrowser(target) {
  const options = { detached: true, stdio: 'ignore' };
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', target], options).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [target], options).unref();
  } else {
    spawn('xdg-open', [target], options).unref();
  }
}

async function waitForServer() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2_500)
      });
      if (response.ok) return true;
    } catch {
      // Servidor ainda subindo: tenta de novo.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  return false;
}

const ready = await waitForServer();
if (ready) {
  console.log(`[AuditAI GCB] Servidor pronto em ${baseUrl} - abrindo o navegador...`);
  openBrowser(baseUrl);
} else {
  console.error(`[AuditAI GCB] Servidor nao respondeu a tempo. Abra ${baseUrl} manualmente.`);
}

/**
 * Executa uma mutação do documento com retry otimista.
 *
 * O problema que isto resolve: uma instância morna pode ter uma versão antiga
 * do estado. Se ela gravar por cima, apaga alterações de outra instância; se
 * apenas descartar a gravação, a alteração do usuário some depois de a API ter
 * respondido sucesso. Aqui a mutação é reaplicada sobre o estado mais novo até
 * a gravação vencer ou esgotar as tentativas (aí o chamador devolve 409).
 */

export class StateMutationRejected extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StateMutationRejected";
    this.status = status;
  }
}

export type StateMutationResult =
  | { ok: true; attempts: number }
  | { ok: false; attempts: number; conflict: boolean };

export async function runStateMutation(opts: {
  /** Recarrega o documento remoto mais recente antes de cada tentativa. */
  readLatest: () => Promise<unknown>;
  /** Reaplica a mutação; precisa ser idempotente entre tentativas. */
  apply: () => void;
  /** Grava o snapshot atual. `false` = conflito de versão, deve tentar de novo. */
  write: () => Promise<boolean>;
  maxAttempts?: number;
}): Promise<StateMutationResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 4);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await opts.readLatest();
    opts.apply();
    if (await opts.write()) return { ok: true, attempts: attempt };
  }

  // Esgotou as tentativas: descarta a mutação local para não deixar a instância
  // servindo um estado que nunca foi persistido.
  await opts.readLatest();
  return { ok: false, attempts: maxAttempts, conflict: true };
}

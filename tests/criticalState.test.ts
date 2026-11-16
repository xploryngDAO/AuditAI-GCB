import test from "node:test";
import assert from "node:assert/strict";
import { runStateMutation, StateMutationRejected } from "../server/criticalState.ts";

test("grava na primeira tentativa quando não há conflito", async () => {
  let reads = 0;
  let writes = 0;
  let applies = 0;
  const result = await runStateMutation({
    readLatest: async () => {
      reads += 1;
    },
    apply: () => {
      applies += 1;
    },
    write: async () => {
      writes += 1;
      return true;
    }
  });

  assert.deepEqual(result, { ok: true, attempts: 1 });
  assert.equal(reads, 1);
  assert.equal(applies, 1);
  assert.equal(writes, 1);
});

test("reaplica sobre o estado mais novo quando perde a corrida", async () => {
  let state: string[] = [];
  let writes = 0;
  const applied: string[][] = [];

  const result = await runStateMutation({
    readLatest: async () => {
      state = ["remoto"];
    },
    apply: () => {
      state = [...state, "local"];
      applied.push([...state]);
    },
    write: async () => {
      writes += 1;
      return writes >= 3;
    }
  });

  assert.deepEqual(result, { ok: true, attempts: 3 });
  assert.equal(writes, 3);
  assert.equal(applied.length, 3);
  // Cada tentativa partiu do remoto recarregado, sem acumular duplicatas.
  assert.deepEqual(state, ["remoto", "local"]);
  assert.deepEqual(applied[2], ["remoto", "local"]);
});

test("esgota as tentativas, recarrega e sinaliza conflito", async () => {
  let reads = 0;
  let applies = 0;
  let state: string[] = [];

  const result = await runStateMutation({
    readLatest: async () => {
      reads += 1;
      state = ["remoto"];
    },
    apply: () => {
      applies += 1;
      state = [...state, "local"];
    },
    write: async () => false,
    maxAttempts: 3
  });

  assert.deepEqual(result, { ok: false, attempts: 3, conflict: true });
  assert.equal(applies, 3);
  // 3 leituras antes das tentativas + 1 leitura final para descartar a mutação.
  assert.equal(reads, 4);
  assert.deepEqual(state, ["remoto"]);
});

test("respeita maxAttempts mínimo de 1", async () => {
  let writes = 0;
  const result = await runStateMutation({
    readLatest: async () => undefined,
    apply: () => undefined,
    write: async () => {
      writes += 1;
      return false;
    },
    maxAttempts: 0
  });

  assert.equal(writes, 1);
  assert.equal(result.ok, false);
});

test("erro de validação da mutação interrompe sem gravar", async () => {
  let writes = 0;
  await assert.rejects(
    runStateMutation({
      readLatest: async () => undefined,
      apply: () => {
        throw new StateMutationRejected("Tenant não encontrado.", 404);
      },
      write: async () => {
        writes += 1;
        return true;
      }
    }),
    (error: any) => error instanceof StateMutationRejected && error.status === 404
  );
  assert.equal(writes, 0);
});

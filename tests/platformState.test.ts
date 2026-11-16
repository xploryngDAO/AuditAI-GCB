import test from "node:test";
import assert from "node:assert/strict";
import {
  ensurePlatformStateTable,
  readPlatformState,
  writePlatformState
} from "../server/platformState.ts";

type FakeCall = { text: string; values: any[] };

function fakeSql(handler: (text: string, values: any[]) => any) {
  const calls: FakeCall[] = [];
  const fn: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    calls.push({ text, values });
    return handler(text, values);
  };
  return { fn, calls };
}

test("ensurePlatformStateTable cria a tabela e a coluna de versão", async () => {
  const fake = fakeSql(() => []);
  await ensurePlatformStateTable(fake.fn);
  assert.equal(fake.calls.length, 2);
  assert.match(fake.calls[0].text, /create table if not exists platform_state/);
  assert.match(fake.calls[1].text, /add column if not exists version/);
});

test("readPlatformState devolve estado e versão, aceitando jsonb como string", async () => {
  const fake = fakeSql(() => [{ state: '{"tenantsDb":[]}', version: 7 }]);
  const result = await readPlatformState(fake.fn);
  assert.deepEqual(result, { state: { tenantsDb: [] }, version: 7 });
});

test("readPlatformState devolve null quando o documento ainda não existe", async () => {
  const result = await readPlatformState(fakeSql(() => []).fn);
  assert.equal(result, null);
});

test("writePlatformState usa INSERT ... ON CONFLICT com guarda de versão", async () => {
  const fake = fakeSql(() => [{ version: 4 }]);
  const result = await writePlatformState(fake.fn, '{"ok":true}', 3);
  assert.deepEqual(result, { version: 4 });
  const query = fake.calls[0].text;
  assert.match(query, /insert into platform_state/);
  assert.match(query, /on conflict \(id\) do update/);
  assert.match(query, /where platform_state\.version = \?/);
  assert.deepEqual(fake.calls[0].values.slice(1), [3, 3]);
});

test("writePlatformState devolve null quando perde a corrida de versão", async () => {
  const result = await writePlatformState(fakeSql(() => []).fn, '{"ok":true}', 3);
  assert.equal(result, null);
});

test("primeira gravação em banco vazio cria a versão 1", async () => {
  const fake = fakeSql(() => [{ version: 1 }]);
  const result = await writePlatformState(fake.fn, '{"seed":true}', 0);
  assert.deepEqual(result, { version: 1 });
  assert.match(fake.calls[0].text, /insert into platform_state/);
});

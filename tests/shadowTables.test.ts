import test from "node:test";
import assert from "node:assert/strict";
import { getShadowStatus, syncShadowTables } from "../server/shadowTables.ts";

function fakeSql() {
  const calls: { text: string; values: any[] }[] = [];
  const fn: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    calls.push({ text, values });
    if (text.includes("count(*)")) return [{ n: 0 }];
    return [];
  };
  return { fn, calls };
}

const user = (email: string) => ({ email, passwordHash: "hash", role: "admin", tenantId: "t1" });

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("sync desabilitado não toca no banco", async () => {
  const fake = fakeSql();
  await syncShadowTables({ sql: fake.fn, data: { usersDb: [user("a@x.com")] }, enabled: false });
  assert.equal(fake.calls.length, 0);
  assert.equal(getShadowStatus().enabled, false);
});

test("ciclos concorrentes não são pulados: o último snapshot roda depois do atual", async () => {
  const fake = fakeSql();
  const first = syncShadowTables({
    sql: fake.fn,
    data: { usersDb: [user("primeiro@x.com")], interactionsDb: [] },
    enabled: true
  });
  const second = syncShadowTables({
    sql: fake.fn,
    data: { usersDb: [user("segundo@x.com")], interactionsDb: [] },
    enabled: true
  });

  await Promise.all([first, second]);
  await flush();
  await flush();

  const inserts = fake.calls.filter((call) => call.text.includes("insert into app_users"));
  assert.equal(inserts.length, 2);
  const emails = inserts.map((call) => call.values[0]);
  assert.deepEqual(emails.sort(), ["primeiro@x.com", "segundo@x.com"]);
  assert.ok(getShadowStatus().syncedAt);
  assert.equal(getShadowStatus().lastError, null);
});

test("usuário removido do documento sai do espelho", async () => {
  const calls: { text: string; values: any[] }[] = [];
  const sql: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    calls.push({ text, values });
    if (text.includes("select email from app_users")) return [{ email: "antigo@x.com" }];
    if (text.includes("count(*)")) return [{ n: 0 }];
    return [];
  };

  await syncShadowTables({ sql, data: { usersDb: [user("vivo@x.com")] }, enabled: true });
  const deletes = calls.filter((call) => call.text.includes("delete from app_users"));
  assert.equal(deletes.length, 1);
  assert.deepEqual(deletes[0].values, ["antigo@x.com"]);
});

test("falha no sync fica registrada e não lança", async () => {
  const broken: any = async () => {
    throw new Error("banco indisponível");
  };
  await syncShadowTables({ sql: broken, data: { usersDb: [] }, enabled: true });
  assert.match(String(getShadowStatus().lastError), /banco indisponível/);
  assert.ok(getShadowStatus().syncedAt);
});

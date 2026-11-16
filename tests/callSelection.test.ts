import test from "node:test";
import assert from "node:assert/strict";
import { nextActiveCallId } from "../src/utils/callSelection.ts";

const calls = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("sem seleção anterior escolhe o primeiro chamado", () => {
  assert.equal(nextActiveCallId(null, calls), "a");
});

test("mantém o chamado selecionado mesmo com o polling trazendo uma lista nova", () => {
  assert.equal(nextActiveCallId("b", [{ id: "a" }, { id: "b" }, { id: "c" }]), "b");
});

test("se o chamado selecionado saiu da lista, escolhe o primeiro", () => {
  assert.equal(nextActiveCallId("b", [{ id: "a" }, { id: "c" }]), "a");
});

test("lista vazia limpa a seleção", () => {
  assert.equal(nextActiveCallId("b", []), null);
});

test("seleção do usuário não é desfeita quando o polling começa sem seleção", () => {
  // Reproduz o bug: o closure antigo tinha previousId=null e reaplicava a[0].
  const afterFirstPoll = nextActiveCallId(null, calls);
  assert.equal(afterFirstPoll, "a");
  assert.equal(nextActiveCallId("b", calls), "b");
});

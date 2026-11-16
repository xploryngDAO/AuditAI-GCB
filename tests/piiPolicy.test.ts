import test from "node:test";
import assert from "node:assert/strict";
import {
  piiMaskingOverrideForTenant,
  resolvePiiMaskingEnabled
} from "../src/utils/piiPolicy.ts";

test("sem override do tenant, default global mascarado vence", () => {
  assert.equal(resolvePiiMaskingEnabled(undefined, true), true);
  assert.equal(resolvePiiMaskingEnabled(undefined, undefined), true);
  assert.equal(resolvePiiMaskingEnabled(undefined, false), false);
});

test("decisão explícita do tenant vence o default global", () => {
  assert.equal(resolvePiiMaskingEnabled(false, true), false);
  assert.equal(resolvePiiMaskingEnabled(true, false), true);
});

test("valores não booleanos caem no default global", () => {
  assert.equal(resolvePiiMaskingEnabled("false", true), true);
  assert.equal(resolvePiiMaskingEnabled(0, true), true);
  assert.equal(resolvePiiMaskingEnabled(null, false), false);
});

test("extrai override do tenant e ignora o sentinela global", () => {
  const configs = {
    "tenant-a": { piiMaskingEnabled: false },
    "tenant-b": { piiMaskingEnabled: true },
    "tenant-c": { piiMaskingEnabled: "sim" }
  };
  assert.equal(piiMaskingOverrideForTenant(configs, "tenant-a"), false);
  assert.equal(piiMaskingOverrideForTenant(configs, "tenant-b"), true);
  assert.equal(piiMaskingOverrideForTenant(configs, "tenant-c"), undefined);
  assert.equal(piiMaskingOverrideForTenant(configs, "system-global"), undefined);
  assert.equal(piiMaskingOverrideForTenant(undefined, "tenant-a"), undefined);
});

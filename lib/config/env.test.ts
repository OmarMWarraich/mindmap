import assert from "node:assert/strict";
import test from "node:test";

import {
  getProviderApiKeyEnvVarName,
  getProviderCredentials,
  isProviderConfigured,
} from "./env.ts";

test("getProviderApiKeyEnvVarName maps providers to their env var names", () => {
  assert.equal(getProviderApiKeyEnvVarName("openai"), "OPENAI_API_KEY");
  assert.equal(getProviderApiKeyEnvVarName("anthropic"), "ANTHROPIC_API_KEY");
});

test("isProviderConfigured is true only for providers with a real key", () => {
  const env = { OPENAI_API_KEY: "sk-real-openai-key" };
  assert.equal(isProviderConfigured("openai", env), true);
  assert.equal(isProviderConfigured("anthropic", env), false);
});

test("isProviderConfigured rejects placeholder and blank keys", () => {
  assert.equal(
    isProviderConfigured("openai", {
      OPENAI_API_KEY: "replace-with-real-openai-key",
    }),
    false,
  );
  assert.equal(
    isProviderConfigured("openai", { OPENAI_API_KEY: "   " }),
    false,
  );
  assert.equal(isProviderConfigured("openai", {}), false);
});

test("getProviderCredentials returns the trimmed api key for a configured provider", () => {
  const credentials = getProviderCredentials("anthropic", {
    ANTHROPIC_API_KEY: "  sk-ant-real-key  ",
  });
  assert.deepEqual(credentials, { apiKey: "sk-ant-real-key" });
});

test("getProviderCredentials throws a descriptive error when the key is missing", () => {
  assert.throws(
    () => getProviderCredentials("anthropic", {}),
    /Set ANTHROPIC_API_KEY to use anthropic models/,
  );
});

test("getProviderCredentials validates lazily per provider", () => {
  const env = { OPENAI_API_KEY: "sk-real-openai-key" };
  assert.deepEqual(getProviderCredentials("openai", env), {
    apiKey: "sk-real-openai-key",
  });
  assert.throws(() => getProviderCredentials("anthropic", env));
});

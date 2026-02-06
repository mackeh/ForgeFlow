import test from "node:test";
import assert from "node:assert/strict";
import { resetAuthStateForTests, verifyLogin } from "./auth.js";

test("verifyLogin accepts configured plaintext credentials", async () => {
  process.env.APP_USERNAME = "local";
  process.env.APP_PASSWORD = "localpass";
  process.env.APP_PASSWORD_HASH_ARGON2 = "";
  resetAuthStateForTests();

  const ok = await verifyLogin("local", "localpass");
  assert.equal(ok, true);
});

test("verifyLogin locks account after repeated failures", async () => {
  process.env.APP_USERNAME = "local";
  process.env.APP_PASSWORD = "localpass";
  process.env.APP_PASSWORD_HASH_ARGON2 = "";
  resetAuthStateForTests();

  for (let i = 0; i < 6; i += 1) {
    const ok = await verifyLogin("local", "wrong");
    assert.equal(ok, false);
  }

  const correctAfterLock = await verifyLogin("local", "localpass");
  assert.equal(correctAfterLock, false);
});

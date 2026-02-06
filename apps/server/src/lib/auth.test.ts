import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { decodeTokenForTests, resetAuthStateForTests, signToken, verifyLogin } from "./auth.js";

async function resetAuthzFileForTest(testId: string) {
  const file = path.join(os.tmpdir(), `forgeflow-authz-${testId}.json`);
  process.env.AUTHZ_FILE = file;
  process.env.APP_USERNAME = "local";
  process.env.APP_PASSWORD = "localpass";
  process.env.APP_PASSWORD_HASH_ARGON2 = "";
  await rm(file, { force: true });
  resetAuthStateForTests();
  return file;
}

test("verifyLogin accepts bootstrap local credentials", async () => {
  await resetAuthzFileForTest("login-ok");

  const user = await verifyLogin("local", "localpass");
  assert.equal(Boolean(user), true);
  assert.equal(user?.username, "local");
  assert.equal(user?.role, "admin");
});

test("verifyLogin locks account after repeated failures", async () => {
  await resetAuthzFileForTest("lock");

  for (let i = 0; i < 6; i += 1) {
    const user = await verifyLogin("local", "wrong");
    assert.equal(user, null);
  }

  const userAfterLock = await verifyLogin("local", "localpass");
  assert.equal(userAfterLock, null);
});

test("signToken encodes username and role", () => {
  const token = signToken({ username: "alice", role: "operator" });
  const decoded = decodeTokenForTests(token);
  assert.equal(decoded?.username, "alice");
  assert.equal(decoded?.role, "operator");
});

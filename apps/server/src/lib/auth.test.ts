import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import jwt from "jsonwebtoken";
import { decodeTokenForTests, resetAuthStateForTests, resolveAuthContextFromToken, signToken, verifyLogin } from "./auth.js";
import { beginTwoFactorSetup, confirmTwoFactorSetup } from "./authzStore.js";
import { generateTotpToken } from "./totp.js";

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

  const result = await verifyLogin("local", "localpass");
  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.equal(result.auth.username, "local");
    assert.equal(result.auth.role, "admin");
  }
});

test("verifyLogin locks account after repeated failures", async () => {
  await resetAuthzFileForTest("lock");

  for (let i = 0; i < 6; i += 1) {
    const result = await verifyLogin("local", "wrong");
    assert.equal(result.status, "invalid");
  }

  const userAfterLock = await verifyLogin("local", "localpass");
  assert.equal(userAfterLock.status, "locked");
});

test("signToken encodes username and role", () => {
  const token = signToken({ username: "alice", role: "operator" });
  const decoded = decodeTokenForTests(token);
  assert.equal(decoded?.username, "alice");
  assert.equal(decoded?.role, "operator");
});

test("legacy username-only token resolves role from local authz store", async () => {
  await resetAuthzFileForTest("legacy-token");
  const token = jwt.sign({ username: "local" }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "12h" });
  const auth = await resolveAuthContextFromToken(token);
  assert.equal(auth?.username, "local");
  assert.equal(auth?.role, "admin");
  assert.equal(Array.isArray(auth?.permissions), true);
});

test("verifyLogin enforces 2fa when enabled", async () => {
  await resetAuthzFileForTest("login-2fa");
  const setup = await beginTwoFactorSetup("local");
  const enableToken = generateTotpToken(setup.secret, { at: new Date() });
  await confirmTwoFactorSetup("local", enableToken);

  const noCode = await verifyLogin("local", "localpass");
  assert.equal(noCode.status, "totp_required");

  const wrongCode = await verifyLogin("local", "localpass", "000000");
  assert.equal(wrongCode.status, "totp_invalid");

  const validCode = generateTotpToken(setup.secret, { at: new Date() });
  const ok = await verifyLogin("local", "localpass", validCode);
  assert.equal(ok.status, "ok");
});

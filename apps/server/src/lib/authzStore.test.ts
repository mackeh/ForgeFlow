import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  createUser,
  getTwoFactorStatus,
  listRoles,
  listUsers,
  upsertRolePermissions,
  updateUser,
  verifyUserCredentials
} from "./authzStore.js";
import { generateTotpToken } from "./totp.js";

async function useTempAuthz(testName: string) {
  const file = path.join(os.tmpdir(), `forgeflow-authz-store-${testName}.json`);
  process.env.AUTHZ_FILE = file;
  process.env.APP_USERNAME = "local";
  process.env.APP_PASSWORD = "localpass";
  process.env.APP_PASSWORD_HASH_ARGON2 = "";
  await rm(file, { force: true });
}

test("authz store bootstraps default admin user", async () => {
  await useTempAuthz("bootstrap");
  const users = await listUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].username, "local");
  assert.equal(users[0].role, "admin");
});

test("authz store supports creating and updating users", async () => {
  await useTempAuthz("users");

  const created = await createUser({
    username: "operator1",
    password: "secret123",
    role: "operator"
  });
  assert.equal(created.username, "operator1");

  const updated = await updateUser("operator1", { role: "viewer", disabled: true });
  assert.equal(updated.role, "viewer");
  assert.equal(updated.disabled, true);

  const verified = await verifyUserCredentials("operator1", "secret123");
  assert.equal(verified, null);
});

test("roles can be customized", async () => {
  await useTempAuthz("roles");
  await upsertRolePermissions("qa", ["workflows:read", "metrics:read"]);
  const roles = await listRoles();
  const qa = roles.find((entry) => entry.role === "qa");
  assert.ok(qa);
  assert.equal(qa?.permissions.includes("metrics:read"), true);
});

test("2fa setup can be enabled with valid totp code", async () => {
  await useTempAuthz("2fa");
  const setup = await beginTwoFactorSetup("local");
  assert.equal(typeof setup.secret, "string");
  assert.equal(setup.otpauthUrl.startsWith("otpauth://totp/"), true);

  const token = generateTotpToken(setup.secret, { at: new Date() });
  const user = await confirmTwoFactorSetup("local", token);
  assert.equal(user.twoFactorEnabled, true);

  const status = await getTwoFactorStatus("local");
  assert.equal(status.enabled, true);
});

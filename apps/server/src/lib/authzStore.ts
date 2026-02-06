import { mkdir, readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

export const defaultRolePermissions: Record<string, string[]> = {
  admin: ["*"],
  operator: [
    "workflows:read",
    "workflows:write",
    "workflows:execute",
    "workflows:approve",
    "schedules:manage",
    "templates:read",
    "metrics:read",
    "secrets:read",
    "secrets:write"
  ],
  viewer: ["workflows:read", "templates:read", "metrics:read", "secrets:read"]
};

export type LocalUser = {
  id: string;
  username: string;
  role: string;
  passwordHashArgon2: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthzStore = {
  users: LocalUser[];
  roles: Record<string, string[]>;
};

function authzFilePath() {
  return process.env.AUTHZ_FILE || path.resolve(process.cwd(), "data", "authz.json");
}

async function hashPassword(rawPassword: string) {
  return argon2.hash(rawPassword, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    type: argon2.argon2id
  });
}

async function bootstrapAdminUser() {
  const username = (process.env.APP_USERNAME || "local").trim() || "local";
  const argonHash = (process.env.APP_PASSWORD_HASH_ARGON2 || "").trim();
  const plainPassword = process.env.APP_PASSWORD || "localpass";
  const passwordHashArgon2 = argonHash.startsWith("$argon2") ? argonHash : await hashPassword(plainPassword);
  const now = new Date().toISOString();
  const user: LocalUser = {
    id: randomUUID(),
    username,
    role: "admin",
    passwordHashArgon2,
    disabled: false,
    createdAt: now,
    updatedAt: now
  };
  return user;
}

async function ensureStoreFile() {
  const authzFile = authzFilePath();
  const dir = path.dirname(authzFile);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(authzFile, "utf8");
  } catch {
    const initial: AuthzStore = {
      users: [await bootstrapAdminUser()],
      roles: { ...defaultRolePermissions }
    };
    await writeFile(authzFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<AuthzStore> {
  const authzFile = authzFilePath();
  await ensureStoreFile();
  const raw = await readFile(authzFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as AuthzStore;
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    const roles = parsed.roles && typeof parsed.roles === "object" ? parsed.roles : {};
    return {
      users,
      roles: {
        ...defaultRolePermissions,
        ...roles
      }
    };
  } catch {
    return {
      users: [await bootstrapAdminUser()],
      roles: { ...defaultRolePermissions }
    };
  }
}

async function writeStore(store: AuthzStore) {
  const authzFile = authzFilePath();
  await ensureStoreFile();
  await writeFile(authzFile, JSON.stringify(store, null, 2), "utf8");
}

export function sanitizeUser(user: LocalUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    disabled: user.disabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function listUsers() {
  const store = await readStore();
  return store.users
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username))
    .map(sanitizeUser);
}

export async function getUserByUsername(username: string) {
  const store = await readStore();
  return store.users.find((user) => user.username === username) || null;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role?: string;
  disabled?: boolean;
}) {
  const store = await readStore();
  const username = payload.username.trim();
  if (!username) {
    throw new Error("Username is required");
  }
  if (!payload.password) {
    throw new Error("Password is required");
  }
  if (store.users.some((user) => user.username === username)) {
    throw new Error("User already exists");
  }

  const role = (payload.role || "operator").trim() || "operator";
  if (!store.roles[role]) {
    throw new Error(`Unknown role: ${role}`);
  }

  const now = new Date().toISOString();
  const user: LocalUser = {
    id: randomUUID(),
    username,
    role,
    passwordHashArgon2: await hashPassword(payload.password),
    disabled: Boolean(payload.disabled),
    createdAt: now,
    updatedAt: now
  };

  store.users.push(user);
  await writeStore(store);
  return sanitizeUser(user);
}

export async function updateUser(
  username: string,
  patch: Partial<{
    role: string;
    password: string;
    disabled: boolean;
  }>
) {
  const store = await readStore();
  const idx = store.users.findIndex((user) => user.username === username);
  if (idx < 0) {
    throw new Error("User not found");
  }

  const existing = store.users[idx];
  const next: LocalUser = {
    ...existing,
    updatedAt: new Date().toISOString()
  };

  if (patch.role !== undefined) {
    const role = patch.role.trim();
    if (!store.roles[role]) {
      throw new Error(`Unknown role: ${role}`);
    }
    next.role = role;
  }

  if (patch.password !== undefined) {
    if (!patch.password) {
      throw new Error("Password cannot be empty");
    }
    next.passwordHashArgon2 = await hashPassword(patch.password);
  }

  if (patch.disabled !== undefined) {
    next.disabled = Boolean(patch.disabled);
  }

  store.users[idx] = next;
  await writeStore(store);
  return sanitizeUser(next);
}

export async function deleteUser(username: string) {
  const store = await readStore();
  const before = store.users.length;
  store.users = store.users.filter((user) => user.username !== username);
  if (store.users.length === 0) {
    throw new Error("Cannot delete last user");
  }
  await writeStore(store);
  return before !== store.users.length;
}

export async function listRoles() {
  const store = await readStore();
  return Object.entries(store.roles)
    .map(([role, permissions]) => ({ role, permissions }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

export async function upsertRolePermissions(role: string, permissions: string[]) {
  const store = await readStore();
  const roleName = role.trim();
  if (!roleName) {
    throw new Error("Role is required");
  }
  const normalized = Array.from(
    new Set(
      permissions
        .map((permission) => permission.trim())
        .filter(Boolean)
    )
  );
  if (!normalized.length) {
    throw new Error("At least one permission is required");
  }
  store.roles[roleName] = normalized;
  await writeStore(store);
  return { role: roleName, permissions: normalized };
}

export async function resolvePermissionsForRole(role: string) {
  const store = await readStore();
  return store.roles[role] || [];
}

async function verifyAgainstHash(hash: string, password: string) {
  if (hash.startsWith("$argon2")) {
    return argon2.verify(hash, password);
  }
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }
  return password === hash;
}

export async function verifyUserCredentials(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user || user.disabled) {
    return null;
  }
  const ok = await verifyAgainstHash(user.passwordHashArgon2, password);
  return ok ? user : null;
}

export async function getAuthzSnapshot() {
  const store = await readStore();
  return store;
}

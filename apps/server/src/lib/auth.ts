import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { resolvePermissionsForRole, verifyUserCredentials } from "./authzStore.js";

const jwtSecret = process.env.JWT_SECRET || "dev_secret";
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();
const maxAttempts = Number(process.env.AUTH_MAX_ATTEMPTS || 6);
const lockMs = Number(process.env.AUTH_LOCK_MS || 5 * 60 * 1000);

export type AuthTokenPayload = {
  username: string;
  role: string;
};

export type AuthContext = {
  username: string;
  role: string;
  permissions: string[];
};

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "12h" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthTokenPayload;
    const username = String(decoded?.username || "").trim();
    const role = String(decoded?.role || "").trim();
    if (!username || !role) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    resolvePermissionsForRole(role)
      .then((permissions) => {
        (req as any).auth = { username, role, permissions } satisfies AuthContext;
        next();
      })
      .catch((error) => {
        res.status(401).json({ error: String(error) });
      });
  } catch (_err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = ((req as any).auth || null) as AuthContext | null;
    if (!auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const allowed = auth.permissions.includes("*") || auth.permissions.includes(permission);
    if (!allowed) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

export function getAuthContext(req: Request) {
  return ((req as any).auth || null) as AuthContext | null;
}

export async function verifyLogin(username: string, password: string) {
  const now = Date.now();
  const state = failedAttempts.get(username);

  if (state && state.lockUntil > now) {
    return null;
  }

  const user = await verifyUserCredentials(username, password);
  if (user) {
    failedAttempts.delete(username);
    const permissions = await resolvePermissionsForRole(user.role);
    return { username: user.username, role: user.role, permissions } satisfies AuthContext;
  }

  registerFailure(username);
  return null;
}

function registerFailure(username: string) {
  const now = Date.now();
  const prev = failedAttempts.get(username) || { count: 0, lockUntil: 0 };
  const count = prev.count + 1;
  const lockUntil = count >= maxAttempts ? now + lockMs : 0;
  failedAttempts.set(username, { count, lockUntil });
}

export function resetAuthStateForTests() {
  failedAttempts.clear();
}

export function decodeTokenForTests(token: string) {
  try {
    return jwt.verify(token, jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

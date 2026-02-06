import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import argon2 from "argon2";
import type { Request, Response, NextFunction } from "express";

const jwtSecret = process.env.JWT_SECRET || "dev_secret";
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();
const maxAttempts = Number(process.env.AUTH_MAX_ATTEMPTS || 6);
const lockMs = Number(process.env.AUTH_LOCK_MS || 5 * 60 * 1000);

export function signToken(payload: { username: string }) {
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
    jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function verifyLogin(username: string, password: string) {
  const expectedUser = process.env.APP_USERNAME || "local";
  const expectedPass = process.env.APP_PASSWORD || "localpass";
  const argonHash = process.env.APP_PASSWORD_HASH_ARGON2 || "";
  const now = Date.now();
  const state = failedAttempts.get(username);

  if (state && state.lockUntil > now) {
    return false;
  }

  if (username !== expectedUser) {
    registerFailure(username);
    return false;
  }

  let ok = false;
  if (argonHash.startsWith("$argon2")) {
    ok = await argon2.verify(argonHash, password);
  } else if (expectedPass.startsWith("$2a$") || expectedPass.startsWith("$2b$")) {
    ok = await bcrypt.compare(password, expectedPass);
  } else {
    ok = password === expectedPass;
  }

  if (ok) {
    failedAttempts.delete(username);
    return true;
  }

  registerFailure(username);
  return false;
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

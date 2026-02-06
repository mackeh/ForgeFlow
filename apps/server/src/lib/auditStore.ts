import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type StoredAuditEvent = {
  id: string;
  at: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  message?: string;
  metadata?: unknown;
};

type AuditStoreShape = {
  events: StoredAuditEvent[];
};

type ListAuditFilters = {
  limit?: number;
  actorUsername?: string;
  action?: string;
  resourceType?: string;
  success?: boolean;
};

function auditFilePath() {
  return process.env.AUDIT_FILE || path.resolve(process.cwd(), "data", "audit.json");
}

function maxAuditEvents() {
  const raw = Number(process.env.AUDIT_MAX_EVENTS || 5000);
  if (!Number.isFinite(raw)) return 5000;
  return Math.max(1, Math.min(50_000, Math.floor(raw)));
}

async function ensureStoreFile() {
  const file = auditFilePath();
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(file, "utf8");
  } catch {
    const initial: AuditStoreShape = { events: [] };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<AuditStoreShape> {
  const file = auditFilePath();
  await ensureStoreFile();
  const raw = await readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw) as AuditStoreShape;
    if (!Array.isArray(parsed.events)) return { events: [] };
    return parsed;
  } catch {
    return { events: [] };
  }
}

async function writeStore(store: AuditStoreShape) {
  const file = auditFilePath();
  await ensureStoreFile();
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function appendAuditEvent(payload: {
  actorUsername: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success?: boolean;
  message?: string;
  metadata?: unknown;
}) {
  const store = await readStore();
  const event: StoredAuditEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actorUsername: payload.actorUsername.trim() || "unknown",
    actorRole: (payload.actorRole || "unknown").trim() || "unknown",
    action: payload.action.trim(),
    resourceType: payload.resourceType.trim(),
    resourceId: payload.resourceId?.trim() || undefined,
    success: payload.success !== false,
    message: payload.message?.trim() || undefined,
    metadata: payload.metadata
  };
  store.events.push(event);
  const cap = maxAuditEvents();
  if (store.events.length > cap) {
    store.events = store.events.slice(store.events.length - cap);
  }
  await writeStore(store);
  return event;
}

export async function listAuditEvents(filters: ListAuditFilters = {}) {
  const store = await readStore();
  let events = store.events.slice();
  if (filters.actorUsername) {
    const needle = filters.actorUsername.trim().toLowerCase();
    events = events.filter((event) => event.actorUsername.toLowerCase().includes(needle));
  }
  if (filters.action) {
    const needle = filters.action.trim().toLowerCase();
    events = events.filter((event) => event.action.toLowerCase().includes(needle));
  }
  if (filters.resourceType) {
    const needle = filters.resourceType.trim().toLowerCase();
    events = events.filter((event) => event.resourceType.toLowerCase().includes(needle));
  }
  if (filters.success !== undefined) {
    events = events.filter((event) => event.success === filters.success);
  }
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const limit = Number.isFinite(filters.limit) ? Math.max(1, Math.min(1000, Number(filters.limit))) : 100;
  return events.slice(0, limit);
}

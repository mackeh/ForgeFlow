import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type WebhookEventType = "run.started" | "run.succeeded" | "run.failed" | "run.waiting_approval";

export type StoredWebhook = {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  secret?: string;
  headers?: Record<string, string>;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: string;
  lastDeliveryError?: string;
  createdAt: string;
  updatedAt: string;
};

type WebhookStore = {
  webhooks: StoredWebhook[];
};

function webhookFilePath() {
  return process.env.WEBHOOKS_FILE || path.resolve(process.cwd(), "data", "webhooks.json");
}
const allowedEvents: Set<WebhookEventType> = new Set([
  "run.started",
  "run.succeeded",
  "run.failed",
  "run.waiting_approval"
]);

function normalizeEvents(rawEvents: string[]) {
  const normalized = Array.from(
    new Set(
      rawEvents
        .map((event) => event.trim() as WebhookEventType)
        .filter((event) => allowedEvents.has(event))
    )
  );
  if (!normalized.length) {
    throw new Error("At least one valid event is required");
  }
  return normalized;
}

function normalizeHeaders(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const headers = Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    const header = String(key || "").trim();
    if (!header) return acc;
    acc[header] = String(value ?? "");
    return acc;
  }, {});
  return Object.keys(headers).length ? headers : undefined;
}

async function ensureStoreFile() {
  const webhookFile = webhookFilePath();
  const dir = path.dirname(webhookFile);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(webhookFile, "utf8");
  } catch {
    const initial: WebhookStore = { webhooks: [] };
    await writeFile(webhookFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<WebhookStore> {
  const webhookFile = webhookFilePath();
  await ensureStoreFile();
  const raw = await readFile(webhookFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as WebhookStore;
    return {
      webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : []
    };
  } catch {
    return { webhooks: [] };
  }
}

async function writeStore(store: WebhookStore) {
  const webhookFile = webhookFilePath();
  await ensureStoreFile();
  await writeFile(webhookFile, JSON.stringify(store, null, 2), "utf8");
}

export function listWebhookEventTypes() {
  return Array.from(allowedEvents);
}

export async function listWebhooks() {
  const store = await readStore();
  return store.webhooks;
}

export async function getWebhook(id: string) {
  const store = await readStore();
  return store.webhooks.find((webhook) => webhook.id === id) || null;
}

export async function createWebhook(payload: {
  name: string;
  url: string;
  events: string[];
  enabled?: boolean;
  secret?: string;
  headers?: Record<string, string>;
}) {
  const store = await readStore();
  const name = payload.name.trim();
  const url = payload.url.trim();

  if (!name) {
    throw new Error("Name is required");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Webhook URL must start with http:// or https://");
  }

  const now = new Date().toISOString();
  const webhook: StoredWebhook = {
    id: randomUUID(),
    name,
    url,
    events: normalizeEvents(payload.events || []),
    enabled: payload.enabled !== false,
    secret: payload.secret?.trim() || undefined,
    headers: normalizeHeaders(payload.headers),
    createdAt: now,
    updatedAt: now
  };

  store.webhooks.push(webhook);
  await writeStore(store);
  return webhook;
}

export async function updateWebhook(
  id: string,
  patch: Partial<{
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
    secret: string;
    headers: Record<string, string>;
    lastDeliveryAt: string;
    lastDeliveryStatus: string;
    lastDeliveryError: string;
  }>
) {
  const store = await readStore();
  const idx = store.webhooks.findIndex((webhook) => webhook.id === id);
  if (idx < 0) {
    throw new Error("Webhook not found");
  }

  const existing = store.webhooks[idx];
  const next: StoredWebhook = {
    ...existing,
    updatedAt: new Date().toISOString()
  };

  if (patch.name !== undefined) {
    next.name = patch.name.trim();
  }
  if (patch.url !== undefined) {
    const url = patch.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("Webhook URL must start with http:// or https://");
    }
    next.url = url;
  }
  if (patch.events !== undefined) {
    next.events = normalizeEvents(patch.events);
  }
  if (patch.enabled !== undefined) {
    next.enabled = Boolean(patch.enabled);
  }
  if (patch.secret !== undefined) {
    next.secret = patch.secret.trim() || undefined;
  }
  if (patch.headers !== undefined) {
    next.headers = normalizeHeaders(patch.headers);
  }
  if (patch.lastDeliveryAt !== undefined) {
    next.lastDeliveryAt = patch.lastDeliveryAt;
  }
  if (patch.lastDeliveryStatus !== undefined) {
    next.lastDeliveryStatus = patch.lastDeliveryStatus;
  }
  if (patch.lastDeliveryError !== undefined) {
    next.lastDeliveryError = patch.lastDeliveryError;
  }

  if (!next.name) {
    throw new Error("Name is required");
  }

  store.webhooks[idx] = next;
  await writeStore(store);
  return next;
}

export async function deleteWebhook(id: string) {
  const store = await readStore();
  const before = store.webhooks.length;
  store.webhooks = store.webhooks.filter((webhook) => webhook.id !== id);
  await writeStore(store);
  return before !== store.webhooks.length;
}

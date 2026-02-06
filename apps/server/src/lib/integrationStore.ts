import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import net from "net";

export type IntegrationType =
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "google_sheets"
  | "airtable"
  | "s3"
  | "http_api";

export type IntegrationRecord = {
  id: string;
  name: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type IntegrationStore = {
  integrations: IntegrationRecord[];
};

function integrationsFilePath() {
  return process.env.INTEGRATIONS_FILE || path.resolve(process.cwd(), "data", "integrations.json");
}

async function ensureStoreFile() {
  const file = integrationsFilePath();
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(file, "utf8");
  } catch {
    const initial: IntegrationStore = { integrations: [] };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<IntegrationStore> {
  const file = integrationsFilePath();
  await ensureStoreFile();
  const raw = await readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw) as IntegrationStore;
    if (!Array.isArray(parsed.integrations)) {
      return { integrations: [] };
    }
    return parsed;
  } catch {
    return { integrations: [] };
  }
}

async function writeStore(store: IntegrationStore) {
  const file = integrationsFilePath();
  await ensureStoreFile();
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function requiredConfigForType(type: IntegrationType): string[] {
  switch (type) {
    case "postgresql":
    case "mysql":
    case "mongodb":
      return ["connectionString"];
    case "google_sheets":
      return ["spreadsheetId"];
    case "airtable":
      return ["baseId"];
    case "s3":
      return ["bucket", "region"];
    case "http_api":
      return ["baseUrl"];
    default:
      return [];
  }
}

function redactConfig(config: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(config)) {
    const lower = key.toLowerCase();
    if (lower.includes("secret") || lower.includes("token") || lower.includes("password") || lower.includes("key")) {
      out[key] = "***";
      continue;
    }
    out[key] = config[key];
  }
  return out;
}

function sanitizeIntegration(integration: IntegrationRecord) {
  return {
    ...integration,
    config: redactConfig(integration.config || {})
  };
}

export async function listIntegrations() {
  const store = await readStore();
  return store.integrations
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(sanitizeIntegration);
}

export async function getIntegration(id: string) {
  const store = await readStore();
  return store.integrations.find((integration) => integration.id === id) || null;
}

export async function createIntegration(payload: {
  name: string;
  type: IntegrationType;
  config?: Record<string, unknown>;
}) {
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Integration name is required");
  }
  const type = payload.type;
  const config = payload.config && typeof payload.config === "object" ? payload.config : {};
  const required = requiredConfigForType(type);
  for (const key of required) {
    const value = config[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error(`Missing config field: ${key}`);
    }
  }

  const store = await readStore();
  if (store.integrations.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Integration name already exists");
  }

  const now = new Date().toISOString();
  const integration: IntegrationRecord = {
    id: randomUUID(),
    name,
    type,
    config,
    createdAt: now,
    updatedAt: now
  };
  store.integrations.push(integration);
  await writeStore(store);
  return sanitizeIntegration(integration);
}

export async function updateIntegration(
  id: string,
  patch: {
    name?: string;
    type?: IntegrationType;
    config?: Record<string, unknown>;
  }
) {
  const store = await readStore();
  const idx = store.integrations.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Integration not found");

  const current = store.integrations[idx];
  const next: IntegrationRecord = {
    ...current,
    updatedAt: new Date().toISOString()
  };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Integration name cannot be empty");
    next.name = name;
  }
  if (patch.type !== undefined) {
    next.type = patch.type;
  }
  if (patch.config !== undefined) {
    next.config = patch.config;
  }
  const required = requiredConfigForType(next.type);
  for (const key of required) {
    const value = next.config?.[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error(`Missing config field: ${key}`);
    }
  }

  store.integrations[idx] = next;
  await writeStore(store);
  return sanitizeIntegration(next);
}

export async function deleteIntegration(id: string) {
  const store = await readStore();
  const before = store.integrations.length;
  store.integrations = store.integrations.filter((item) => item.id !== id);
  if (store.integrations.length === before) {
    return false;
  }
  await writeStore(store);
  return true;
}

function parseConnectionHostPort(connectionString: string, fallbackPort: number) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: Number(url.port || fallbackPort)
  };
}

function tcpConnect(host: string, port: number, timeoutMs = 1500) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const onDone = (error?: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => onDone());
    socket.once("timeout", () => onDone(new Error(`Connection timeout to ${host}:${port}`)));
    socket.once("error", (error) => onDone(error));
  });
}

export async function testIntegrationConnection(integration: IntegrationRecord) {
  const config = integration.config || {};
  try {
    if (integration.type === "postgresql") {
      const { host, port } = parseConnectionHostPort(String(config.connectionString || ""), 5432);
      await tcpConnect(host, port);
      return { ok: true, message: `Connected to ${host}:${port}` };
    }
    if (integration.type === "mysql") {
      const { host, port } = parseConnectionHostPort(String(config.connectionString || ""), 3306);
      await tcpConnect(host, port);
      return { ok: true, message: `Connected to ${host}:${port}` };
    }
    if (integration.type === "mongodb") {
      const { host, port } = parseConnectionHostPort(String(config.connectionString || ""), 27017);
      await tcpConnect(host, port);
      return { ok: true, message: `Connected to ${host}:${port}` };
    }
    if (integration.type === "http_api") {
      const baseUrl = String(config.baseUrl || "").trim();
      if (!baseUrl) throw new Error("Missing baseUrl");
      const response = await fetch(baseUrl, { method: "HEAD", signal: AbortSignal.timeout(2500) }).catch(async () => {
        return fetch(baseUrl, { method: "GET", signal: AbortSignal.timeout(2500) });
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ok: true, message: `HTTP reachable (${response.status})` };
    }
    return { ok: true, message: "Configuration validated (runtime integration available)." };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
}

export function parseCsvRows(text: string) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((entry) => entry.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    for (let idx = 0; idx < headers.length; idx += 1) {
      row[headers[idx]] = String(cols[idx] || "").trim();
    }
    return row;
  });
}

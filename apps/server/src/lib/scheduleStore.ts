import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import cron from "node-cron";
import type { MaintenanceWindow } from "./scheduleRules.js";

export type StoredSchedule = {
  id: string;
  workflowId: string;
  name: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  testMode: boolean;
  dependsOnScheduleId?: string;
  maintenanceWindows?: MaintenanceWindow[];
  inputData?: unknown;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  schedules: StoredSchedule[];
};

const schedulesFile = process.env.SCHEDULES_FILE || path.resolve(process.cwd(), "data", "schedules.json");

async function ensureStoreFile() {
  const dir = path.dirname(schedulesFile);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(schedulesFile, "utf8");
  } catch {
    const initial: StoreShape = { schedules: [] };
    await writeFile(schedulesFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStoreFile();
  const raw = await readFile(schedulesFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.schedules)) return { schedules: [] };
    return parsed;
  } catch {
    return { schedules: [] };
  }
}

async function writeStore(store: StoreShape) {
  await ensureStoreFile();
  await writeFile(schedulesFile, JSON.stringify(store, null, 2), "utf8");
}

export function defaultScheduleTimezone() {
  return process.env.SCHEDULE_DEFAULT_TIMEZONE || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function normalizeScheduleTimezone(raw?: string) {
  const candidate = raw?.trim() || defaultScheduleTimezone();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return defaultScheduleTimezone();
  }
}

export function assertValidCron(expression: string) {
  if (!cron.validate(expression)) {
    throw new Error("Invalid cron expression");
  }
}

export function normalizeMaintenanceWindows(raw: unknown): MaintenanceWindow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const normalized: MaintenanceWindow[] = raw
    .map((window) => {
      if (!window || typeof window !== "object") return null;
      const value = window as Record<string, unknown>;
      const start = String(value.start || "").trim();
      const end = String(value.end || "").trim();
      if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(start)) return null;
      if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(end)) return null;

      const weekdays = Array.isArray(value.weekdays)
        ? Array.from(
            new Set(
              value.weekdays
                .map((item) => Number(item))
                .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
            )
          )
        : undefined;

      return {
        start,
        end,
        weekdays: weekdays && weekdays.length ? weekdays : undefined
      };
    })
    .filter(Boolean) as MaintenanceWindow[];
  return normalized.length ? normalized : undefined;
}

export async function listSchedules(workflowId?: string) {
  const store = await readStore();
  if (!workflowId) return store.schedules;
  return store.schedules.filter((schedule) => schedule.workflowId === workflowId);
}

export async function getSchedule(id: string) {
  const store = await readStore();
  return store.schedules.find((schedule) => schedule.id === id) || null;
}

export async function createSchedule(payload: {
  workflowId: string;
  name?: string;
  cron: string;
  timezone?: string;
  enabled?: boolean;
  testMode?: boolean;
  dependsOnScheduleId?: string;
  maintenanceWindows?: MaintenanceWindow[];
  inputData?: unknown;
}) {
  assertValidCron(payload.cron);
  const store = await readStore();
  const now = new Date().toISOString();
  const schedule: StoredSchedule = {
    id: randomUUID(),
    workflowId: payload.workflowId,
    name: payload.name?.trim() || "Scheduled run",
    cron: payload.cron.trim(),
    timezone: normalizeScheduleTimezone(payload.timezone),
    enabled: payload.enabled !== false,
    testMode: Boolean(payload.testMode),
    dependsOnScheduleId: payload.dependsOnScheduleId?.trim() || undefined,
    maintenanceWindows: normalizeMaintenanceWindows(payload.maintenanceWindows),
    inputData: payload.inputData,
    createdAt: now,
    updatedAt: now
  };
  store.schedules.push(schedule);
  await writeStore(store);
  return schedule;
}

export async function updateSchedule(
  id: string,
  patch: Partial<{
    name: string;
    cron: string;
    timezone: string;
    enabled: boolean;
    testMode: boolean;
    dependsOnScheduleId: string;
    maintenanceWindows: MaintenanceWindow[];
    inputData: unknown;
    lastRunAt: string;
    lastRunStatus: string;
    lastRunError: string;
  }>
) {
  const store = await readStore();
  const idx = store.schedules.findIndex((schedule) => schedule.id === id);
  if (idx < 0) throw new Error("Schedule not found");
  const existing = store.schedules[idx];

  if (patch.cron !== undefined) {
    assertValidCron(patch.cron);
  }

  const next: StoredSchedule = {
    ...existing,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    cron: patch.cron !== undefined ? patch.cron.trim() : existing.cron,
    timezone: normalizeScheduleTimezone(patch.timezone || existing.timezone),
    dependsOnScheduleId:
      patch.dependsOnScheduleId !== undefined
        ? patch.dependsOnScheduleId.trim() || undefined
        : existing.dependsOnScheduleId,
    maintenanceWindows:
      patch.maintenanceWindows !== undefined
        ? normalizeMaintenanceWindows(patch.maintenanceWindows)
        : existing.maintenanceWindows,
    updatedAt: new Date().toISOString()
  };
  store.schedules[idx] = next;
  await writeStore(store);
  return next;
}

export async function deleteSchedule(id: string) {
  const store = await readStore();
  const before = store.schedules.length;
  store.schedules = store.schedules.filter((schedule) => schedule.id !== id);
  await writeStore(store);
  return before !== store.schedules.length;
}

export async function deleteSchedulesForWorkflow(workflowId: string) {
  const store = await readStore();
  const before = store.schedules.length;
  store.schedules = store.schedules.filter((schedule) => schedule.workflowId !== workflowId);
  if (before !== store.schedules.length) {
    await writeStore(store);
  }
}

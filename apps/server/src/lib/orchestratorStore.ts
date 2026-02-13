import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type RobotMode = "attended" | "unattended";
export type OrchestratorJobStatus = "queued" | "dispatched" | "completed" | "failed" | "cancelled";

export type OrchestratorRobot = {
  id: string;
  name: string;
  mode: RobotMode;
  enabled: boolean;
  labels: string[];
  maxConcurrentJobs: number;
  lastHeartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrchestratorJob = {
  id: string;
  workflowId: string;
  mode: RobotMode;
  status: OrchestratorJobStatus;
  robotId?: string;
  testMode: boolean;
  inputData?: unknown;
  runId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type OrchestratorStore = {
  robots: OrchestratorRobot[];
  jobs: OrchestratorJob[];
};

function orchestratorFilePath() {
  return process.env.ORCHESTRATOR_FILE || path.resolve(process.cwd(), "data", "orchestrator.json");
}

async function ensureStoreFile() {
  const file = orchestratorFilePath();
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(file, "utf8");
  } catch {
    const initial: OrchestratorStore = { robots: [], jobs: [] };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<OrchestratorStore> {
  const file = orchestratorFilePath();
  await ensureStoreFile();
  const raw = await readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw) as OrchestratorStore;
    return {
      robots: Array.isArray(parsed.robots) ? parsed.robots : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
    };
  } catch {
    return { robots: [], jobs: [] };
  }
}

async function writeStore(store: OrchestratorStore) {
  const file = orchestratorFilePath();
  await ensureStoreFile();
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function listOrchestratorRobots() {
  const store = await readStore();
  return store.robots.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrchestratorRobot(id: string) {
  const store = await readStore();
  return store.robots.find((robot) => robot.id === id) || null;
}

export async function createOrchestratorRobot(payload: {
  name: string;
  mode?: RobotMode;
  enabled?: boolean;
  labels?: string[];
  maxConcurrentJobs?: number;
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const robot: OrchestratorRobot = {
    id: randomUUID(),
    name: String(payload.name || "").trim() || "Robot",
    mode: payload.mode === "attended" ? "attended" : "unattended",
    enabled: payload.enabled !== false,
    labels: Array.isArray(payload.labels) ? payload.labels.map((item) => String(item).trim()).filter(Boolean) : [],
    maxConcurrentJobs: Number(payload.maxConcurrentJobs || 1) > 0 ? Math.floor(Number(payload.maxConcurrentJobs || 1)) : 1,
    createdAt: now,
    updatedAt: now
  };
  store.robots.push(robot);
  await writeStore(store);
  return robot;
}

export async function updateOrchestratorRobot(
  id: string,
  patch: Partial<{
    name: string;
    mode: RobotMode;
    enabled: boolean;
    labels: string[];
    maxConcurrentJobs: number;
    lastHeartbeatAt: string;
  }>
) {
  const store = await readStore();
  const idx = store.robots.findIndex((robot) => robot.id === id);
  if (idx < 0) throw new Error("Robot not found");
  const existing = store.robots[idx];
  const next: OrchestratorRobot = {
    ...existing,
    ...patch,
    name: patch.name !== undefined ? String(patch.name).trim() || existing.name : existing.name,
    mode: patch.mode === "attended" ? "attended" : patch.mode === "unattended" ? "unattended" : existing.mode,
    labels: patch.labels
      ? patch.labels.map((item) => String(item).trim()).filter(Boolean)
      : existing.labels,
    maxConcurrentJobs:
      patch.maxConcurrentJobs !== undefined
        ? Number(patch.maxConcurrentJobs) > 0
          ? Math.floor(Number(patch.maxConcurrentJobs))
          : existing.maxConcurrentJobs
        : existing.maxConcurrentJobs,
    updatedAt: new Date().toISOString()
  };
  store.robots[idx] = next;
  await writeStore(store);
  return next;
}

export async function listOrchestratorJobs(filters?: { status?: OrchestratorJobStatus; workflowId?: string }) {
  const store = await readStore();
  let jobs = store.jobs.slice();
  if (filters?.status) {
    jobs = jobs.filter((job) => job.status === filters.status);
  }
  if (filters?.workflowId) {
    jobs = jobs.filter((job) => job.workflowId === filters.workflowId);
  }
  jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return jobs;
}

export async function getOrchestratorJob(id: string) {
  const store = await readStore();
  return store.jobs.find((job) => job.id === id) || null;
}

export async function createOrchestratorJob(payload: {
  workflowId: string;
  mode?: RobotMode;
  robotId?: string;
  testMode?: boolean;
  inputData?: unknown;
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const job: OrchestratorJob = {
    id: randomUUID(),
    workflowId: String(payload.workflowId || "").trim(),
    mode: payload.mode === "attended" ? "attended" : "unattended",
    status: "queued",
    robotId: payload.robotId?.trim() || undefined,
    testMode: Boolean(payload.testMode),
    inputData: payload.inputData,
    createdAt: now,
    updatedAt: now
  };
  store.jobs.push(job);
  await writeStore(store);
  return job;
}

export async function updateOrchestratorJob(
  id: string,
  patch: Partial<{
    mode: RobotMode;
    status: OrchestratorJobStatus;
    robotId: string;
    runId: string;
    error: string;
    inputData: unknown;
    testMode: boolean;
  }>
) {
  const store = await readStore();
  const idx = store.jobs.findIndex((job) => job.id === id);
  if (idx < 0) throw new Error("Job not found");
  const existing = store.jobs[idx];
  const next: OrchestratorJob = {
    ...existing,
    ...patch,
    mode: patch.mode === "attended" ? "attended" : patch.mode === "unattended" ? "unattended" : existing.mode,
    status:
      patch.status && ["queued", "dispatched", "completed", "failed", "cancelled"].includes(patch.status)
        ? patch.status
        : existing.status,
    robotId: patch.robotId !== undefined ? String(patch.robotId).trim() || undefined : existing.robotId,
    runId: patch.runId !== undefined ? String(patch.runId).trim() || undefined : existing.runId,
    error: patch.error !== undefined ? String(patch.error).trim() || undefined : existing.error,
    updatedAt: new Date().toISOString()
  };
  store.jobs[idx] = next;
  await writeStore(store);
  return next;
}

export async function orchestratorOverview() {
  const [robots, jobs] = await Promise.all([listOrchestratorRobots(), listOrchestratorJobs()]);
  const byStatus = jobs.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    robotCount: robots.length,
    enabledRobots: robots.filter((robot) => robot.enabled).length,
    queuedJobs: jobs.filter((job) => job.status === "queued").length,
    dispatchedJobs: jobs.filter((job) => job.status === "dispatched").length,
    byStatus
  };
}

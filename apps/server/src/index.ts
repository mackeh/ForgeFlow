import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import os from "os";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authMiddleware, getAuthContext, requirePermission, signToken, verifyLogin } from "./lib/auth.js";
import { startWebRecorder, attachRecorderWs } from "./lib/recorder.js";
import { getActiveRunCount, startRun, waitForActiveRuns } from "./lib/runner.js";
import { startDesktopRecording, stopDesktopRecording } from "./lib/agent.js";
import {
  deleteWorkflow,
  getWorkflowDefinitionForRun,
  publishWorkflow,
  rollbackWorkflow,
  saveDraftWorkflow
} from "./lib/workflows.js";
import { listSecrets, upsertSecret } from "./lib/secrets.js";
import { preflightForDefinition, preflightForWorkflowId } from "./lib/preflight.js";
import { diffRunNodeStates } from "./lib/runDiff.js";
import { loadRateLimitConfig } from "./lib/rateLimit.js";
import { buildDashboardMetrics } from "./lib/metrics.js";
import { WorkflowScheduler } from "./lib/scheduler.js";
import {
  createSchedule,
  defaultScheduleTimezone,
  deleteSchedule,
  deleteSchedulesForWorkflow,
  getSchedule,
  listSchedules,
  normalizeScheduleTimezone,
  updateSchedule
} from "./lib/scheduleStore.js";
import { buildSchedulePreview, buildUpcomingRuns, listSchedulePresets } from "./lib/schedulePreview.js";
import { getWorkflowTemplate, listWorkflowTemplates } from "./lib/templates.js";
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  updateUser,
  upsertRolePermissions
} from "./lib/authzStore.js";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listWebhookEventTypes,
  listWebhooks,
  updateWebhook
} from "./lib/webhookStore.js";
import { dispatchWebhookTest } from "./lib/webhooks.js";
import { collectHealth } from "./lib/health.js";
import { appendAuditEvent, listAuditEvents } from "./lib/auditStore.js";
import {
  ObservabilityRegistry,
  createStructuredLogger,
  normalizeRequestPath,
  statusClass
} from "./lib/observability.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const prisma = new PrismaClient();
const scheduler = new WorkflowScheduler(prisma);
const rateLimitConfig = loadRateLimitConfig();
const startedAt = Date.now();
const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 30_000);
const requestLogsEnabled = process.env.REQUEST_LOGS !== "0";
const configuredLogLevel = String(process.env.LOG_LEVEL || "info").toLowerCase();
const logLevel = configuredLogLevel === "warn" || configuredLogLevel === "error" ? configuredLogLevel : "info";
const logger = createStructuredLogger("forgeflow-server", logLevel);
const observability = new ObservabilityRegistry();
let schedulerReady = false;
let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

app.use(cors());
app.use(express.json({ limit: "8mb" }));

if (rateLimitConfig.trustProxy) {
  app.set("trust proxy", 1);
}

const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.maxRequests,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." }
});

const loginLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.loginMaxRequests,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

app.use("/api", apiLimiter);

attachRecorderWs(wss);

app.use("/recordings", express.static("/recordings"));
app.use("/artifacts", express.static("/app/artifacts"));

app.use((req, res, next) => {
  const startedNs = process.hrtime.bigint();
  const requestPath = normalizeRequestPath(req.path || req.originalUrl.split("?")[0] || "/");
  observability.incrementGauge("forgeflow_http_in_flight_requests", 1);

  res.on("finish", () => {
    observability.incrementGauge("forgeflow_http_in_flight_requests", -1);
    const durationSec = Number(process.hrtime.bigint() - startedNs) / 1_000_000_000;
    const labels = {
      method: req.method,
      path: requestPath,
      status: statusClass(res.statusCode)
    };
    observability.incrementCounter("forgeflow_http_requests_total", labels);
    if (res.statusCode >= 400) {
      observability.incrementCounter("forgeflow_http_request_errors_total", labels);
    }
    observability.observeHistogram("forgeflow_http_request_duration_seconds", durationSec, {
      method: req.method,
      path: requestPath
    });

    if (requestLogsEnabled && requestPath !== "/metrics") {
      logger.info("http.request", {
        method: req.method,
        path: requestPath,
        statusCode: res.statusCode,
        durationMs: Math.round(durationSec * 1000),
        ip: req.ip
      });
    }
  });

  next();
});

app.get("/metrics", (_req, res) => {
  const memory = process.memoryUsage();
  const output = observability.renderPrometheus([
    { name: "forgeflow_active_runs", value: getActiveRunCount() },
    { name: "forgeflow_scheduler_ready", value: schedulerReady ? 1 : 0 },
    { name: "forgeflow_shutting_down", value: shuttingDown ? 1 : 0 },
    { name: "forgeflow_uptime_seconds", value: Math.floor((Date.now() - startedAt) / 1000) },
    { name: "forgeflow_process_resident_memory_bytes", value: memory.rss },
    { name: "forgeflow_process_heap_used_bytes", value: memory.heapUsed },
    { name: "forgeflow_process_heap_total_bytes", value: memory.heapTotal }
  ]);
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(output);
});

app.get("/health", async (_req, res) => {
  const health = await collectHealth(prisma);
  const status = health.criticalOk ? 200 : 503;
  res.status(status).json({
    ...health,
    schedulerReady,
    shuttingDown,
    activeRuns: getActiveRunCount(),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000)
  });
});

app.get("/ready", async (_req, res) => {
  const health = await collectHealth(prisma);
  const ready = !shuttingDown && schedulerReady && health.criticalOk;
  res.status(ready ? 200 : 503).json({
    ready,
    schedulerReady,
    shuttingDown,
    criticalOk: health.criticalOk,
    dependencies: health.dependencies,
    activeRuns: getActiveRunCount()
  });
});

app.use((req, res, next) => {
  if (!shuttingDown) {
    next();
    return;
  }
  if (req.path === "/health" || req.path === "/ready" || req.path === "/metrics") {
    next();
    return;
  }
  res.status(503).json({ error: "Server is shutting down" });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  if (!schedulerReady) {
    const health = await collectHealth(prisma);
    const ready = health.criticalOk && schedulerReady && !shuttingDown;
    if (!ready) {
      res.status(503).json({
        error: "Server is starting up. Please retry in a few seconds.",
        ready: false,
        schedulerReady,
        criticalOk: health.criticalOk
      });
      return;
    }
  }

  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    await appendAuditEvent({
      actorUsername: "anonymous",
      actorRole: "anonymous",
      action: "auth.login",
      resourceType: "auth",
      success: false,
      message: "Invalid login payload"
    });
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { username, password } = parsed.data;
  const authUser = await verifyLogin(username, password);
  if (!authUser) {
    await appendAuditEvent({
      actorUsername: username,
      actorRole: "unknown",
      action: "auth.login",
      resourceType: "auth",
      success: false,
      message: "Invalid credentials or temporarily locked account"
    });
    res.status(401).json({ error: "Invalid credentials or temporarily locked account" });
    return;
  }
  const token = signToken({ username: authUser.username, role: authUser.role });
  await appendAuditEvent({
    actorUsername: authUser.username,
    actorRole: authUser.role,
    action: "auth.login",
    resourceType: "auth",
    success: true
  });
  res.json({ token, user: authUser });
});

app.use(authMiddleware);

app.get("/api/auth/me", (req, res) => {
  const auth = getAuthContext(req);
  if (!auth) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(auth);
});

const canReadWorkflows = requirePermission("workflows:read");
const canWriteWorkflows = requirePermission("workflows:write");
const canExecuteWorkflows = requirePermission("workflows:execute");
const canApproveWorkflows = requirePermission("workflows:approve");
const canManageSchedules = requirePermission("schedules:manage");
const canReadTemplates = requirePermission("templates:read");
const canReadMetrics = requirePermission("metrics:read");
const canReadSecrets = requirePermission("secrets:read");
const canWriteSecrets = requirePermission("secrets:write");
const canManageUsers = requirePermission("users:manage");
const canManageRoles = requirePermission("roles:manage");
const canManageWebhooks = requirePermission("webhooks:manage");
const canReadAudit = requirePermission("audit:read");

function toOptionalBoolean(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

async function writeAuditEvent(
  req: express.Request,
  payload: {
    action: string;
    resourceType: string;
    resourceId?: string;
    success?: boolean;
    message?: string;
    metadata?: unknown;
  }
) {
  try {
    const auth = getAuthContext(req);
    await appendAuditEvent({
      actorUsername: auth?.username || "system",
      actorRole: auth?.role || "system",
      ...payload
    });
  } catch (error) {
    logger.error("audit.write_failed", { error });
  }
}

app.get("/api/system/time", (_req, res) => {
  const timezone = defaultScheduleTimezone();
  const now = new Date();
  const localTime = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(now);
  res.json({ nowUtc: now.toISOString(), timezone, localTime });
});

app.get("/api/templates", canReadTemplates, (_req, res) => {
  res.json(listWorkflowTemplates());
});

app.post("/api/workflows/from-template", canWriteWorkflows, async (req, res) => {
  const schema = z.object({
    templateId: z.string(),
    name: z.string().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const template = getWorkflowTemplate(parsed.data.templateId);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: parsed.data.name?.trim() || template.name,
      definition: template.definition as any,
      draftDefinition: template.definition as any
    }
  });
  await saveDraftWorkflow(prisma, workflow.id, template.definition, `Created from template ${template.id}`);
  await writeAuditEvent(req, {
    action: "workflow.create_from_template",
    resourceType: "workflow",
    resourceId: workflow.id,
    metadata: {
      templateId: template.id,
      name: workflow.name
    }
  });
  res.json(workflow);
});

app.get("/api/workflows", canReadWorkflows, async (_req, res) => {
  const workflows = await prisma.workflow.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(workflows);
});

app.post("/api/workflows", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ name: z.string(), definition: z.any().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const initialDefinition = parsed.data.definition || {
    nodes: [{ id: "start", type: "action", position: { x: 80, y: 80 }, data: { type: "start", label: "Start" } }],
    edges: [],
    execution: {
      globalTimeoutMs: 1800000,
      defaultRetries: 2,
      defaultNodeTimeoutMs: 30000
    }
  };

  const workflow = await prisma.workflow.create({
    data: {
      name: parsed.data.name,
      definition: initialDefinition,
      draftDefinition: initialDefinition
    }
  });
  await saveDraftWorkflow(prisma, workflow.id, initialDefinition, "Initial draft");
  await writeAuditEvent(req, {
    action: "workflow.create",
    resourceType: "workflow",
    resourceId: workflow.id,
    metadata: { name: workflow.name }
  });
  res.json(workflow);
});

app.put("/api/workflows/:id", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ name: z.string().optional(), definition: z.any().optional(), notes: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  try {
    const payload: any = {};
    if (parsed.data.name) payload.name = parsed.data.name;

    let workflow;
    if (parsed.data.definition !== undefined) {
      workflow = await saveDraftWorkflow(prisma, req.params.id, parsed.data.definition, parsed.data.notes);
      if (payload.name) {
        workflow = await prisma.workflow.update({ where: { id: req.params.id }, data: payload });
      }
    } else {
      workflow = await prisma.workflow.update({ where: { id: req.params.id }, data: payload });
    }
    await writeAuditEvent(req, {
      action: "workflow.update",
      resourceType: "workflow",
      resourceId: req.params.id,
      metadata: {
        renamed: Boolean(parsed.data.name),
        definitionUpdated: parsed.data.definition !== undefined
      }
    });
    res.json(workflow);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "workflow.update",
      resourceType: "workflow",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.post("/api/workflows/:id/publish", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ notes: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const published = await publishWorkflow(prisma, req.params.id, parsed.data.notes);
    await writeAuditEvent(req, {
      action: "workflow.publish",
      resourceType: "workflow",
      resourceId: req.params.id,
      metadata: {
        version: published.publishedVersion
      }
    });
    res.json(published);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "workflow.publish",
      resourceType: "workflow",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/workflows/:id/versions", canReadWorkflows, async (req, res) => {
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId: req.params.id },
    orderBy: { version: "desc" }
  });
  res.json(versions);
});

app.post("/api/workflows/:id/rollback", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ version: z.number() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const rolled = await rollbackWorkflow(prisma, req.params.id, parsed.data.version);
    await writeAuditEvent(req, {
      action: "workflow.rollback",
      resourceType: "workflow",
      resourceId: req.params.id,
      metadata: {
        version: parsed.data.version
      }
    });
    res.json(rolled);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "workflow.rollback",
      resourceType: "workflow",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.delete("/api/workflows/:id", canWriteWorkflows, async (req, res) => {
  try {
    await deleteSchedulesForWorkflow(req.params.id);
    await deleteWorkflow(prisma, req.params.id);
    await scheduler.refresh();
    await writeAuditEvent(req, {
      action: "workflow.delete",
      resourceType: "workflow",
      resourceId: req.params.id
    });
    res.json({ ok: true });
  } catch (error) {
    await writeAuditEvent(req, {
      action: "workflow.delete",
      resourceType: "workflow",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(404).json({ error: String(error) });
  }
});

app.get("/api/schedules", canManageSchedules, async (req, res) => {
  const workflowId =
    typeof req.query.workflowId === "string" && req.query.workflowId.trim() ? req.query.workflowId.trim() : undefined;
  const schedules = await listSchedules(workflowId);
  res.json(
    schedules.map((schedule) => ({
      ...schedule,
      ...buildSchedulePreview(schedule.cron, schedule.timezone)
    }))
  );
});

app.get("/api/schedules/presets", canManageSchedules, (_req, res) => {
  res.json(listSchedulePresets());
});

app.get("/api/schedules/upcoming", canManageSchedules, async (req, res) => {
  const workflowId =
    typeof req.query.workflowId === "string" && req.query.workflowId.trim() ? req.query.workflowId.trim() : undefined;
  const daysRaw = typeof req.query.days === "string" ? Number(req.query.days) : 14;
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14;
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 60;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 60;
  const perScheduleRaw = typeof req.query.perSchedule === "string" ? Number(req.query.perSchedule) : 4;
  const perSchedule = Number.isFinite(perScheduleRaw) ? Math.max(1, Math.min(24, Math.floor(perScheduleRaw))) : 4;

  const schedules = (await listSchedules(workflowId)).filter((schedule) => schedule.enabled);
  const scanWindowMinutes = days * 24 * 60;
  const now = new Date();

  const items = schedules
    .flatMap((schedule) =>
      buildUpcomingRuns(schedule.cron, schedule.timezone, {
        fromDate: now,
        count: perSchedule,
        scanWindowMinutes
      }).map((run) => ({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        workflowId: schedule.workflowId,
        cron: schedule.cron,
        timezone: schedule.timezone,
        atUtc: run.atUtc,
        atLocal: run.atLocal
      }))
    )
    .sort((a, b) => (a.atUtc < b.atUtc ? -1 : a.atUtc > b.atUtc ? 1 : 0))
    .slice(0, limit);

  res.json({
    generatedAtUtc: now.toISOString(),
    days,
    total: items.length,
    items
  });
});

app.get("/api/schedules/preview", canManageSchedules, async (req, res) => {
  const cron = typeof req.query.cron === "string" ? req.query.cron.trim() : "";
  const timezone = normalizeScheduleTimezone(typeof req.query.timezone === "string" ? req.query.timezone : undefined);
  if (!cron) {
    res.status(400).json({ error: "Cron is required" });
    return;
  }
  res.json(buildSchedulePreview(cron, timezone));
});

app.post("/api/schedules", canManageSchedules, async (req, res) => {
  const maintenanceWindowSchema = z.object({
    start: z.string(),
    end: z.string(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional()
  });
  const schema = z.object({
    workflowId: z.string(),
    name: z.string().optional(),
    cron: z.string(),
    timezone: z.string().optional(),
    enabled: z.boolean().optional(),
    testMode: z.boolean().optional(),
    dependsOnScheduleId: z.string().optional(),
    maintenanceWindows: z.array(maintenanceWindowSchema).optional(),
    inputData: z.any().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const workflow = await prisma.workflow.findUnique({ where: { id: parsed.data.workflowId } });
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  try {
    const schedule = await createSchedule({
      ...parsed.data,
      timezone: normalizeScheduleTimezone(parsed.data.timezone)
    });
    await scheduler.refresh();
    await writeAuditEvent(req, {
      action: "schedule.create",
      resourceType: "schedule",
      resourceId: schedule.id,
      metadata: {
        workflowId: schedule.workflowId,
        cron: schedule.cron,
        timezone: schedule.timezone
      }
    });
    res.json({
      ...schedule,
      ...buildSchedulePreview(schedule.cron, schedule.timezone)
    });
  } catch (error) {
    await writeAuditEvent(req, {
      action: "schedule.create",
      resourceType: "schedule",
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.put("/api/schedules/:id", canManageSchedules, async (req, res) => {
  const maintenanceWindowSchema = z.object({
    start: z.string(),
    end: z.string(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional()
  });
  const schema = z.object({
    name: z.string().optional(),
    cron: z.string().optional(),
    timezone: z.string().optional(),
    enabled: z.boolean().optional(),
    testMode: z.boolean().optional(),
    dependsOnScheduleId: z.string().optional(),
    maintenanceWindows: z.array(maintenanceWindowSchema).optional(),
    inputData: z.any().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const schedule = await updateSchedule(req.params.id, parsed.data);
    await scheduler.refresh();
    await writeAuditEvent(req, {
      action: "schedule.update",
      resourceType: "schedule",
      resourceId: schedule.id,
      metadata: parsed.data
    });
    res.json({
      ...schedule,
      ...buildSchedulePreview(schedule.cron, schedule.timezone)
    });
  } catch (error) {
    await writeAuditEvent(req, {
      action: "schedule.update",
      resourceType: "schedule",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(404).json({ error: String(error) });
  }
});

app.delete("/api/schedules/:id", canManageSchedules, async (req, res) => {
  const removed = await deleteSchedule(req.params.id);
  await scheduler.refresh();
  if (!removed) {
    await writeAuditEvent(req, {
      action: "schedule.delete",
      resourceType: "schedule",
      resourceId: req.params.id,
      success: false,
      message: "Schedule not found"
    });
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  await writeAuditEvent(req, {
    action: "schedule.delete",
    resourceType: "schedule",
    resourceId: req.params.id
  });
  res.json({ ok: true });
});

app.post("/api/schedules/:id/run-now", canManageSchedules, async (req, res) => {
  const schedule = await getSchedule(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  const executed = await scheduler.runNow(req.params.id);
  await writeAuditEvent(req, {
    action: "schedule.run_now",
    resourceType: "schedule",
    resourceId: req.params.id,
    metadata: { executed }
  });
  res.json({ ok: true, executed });
});

app.post("/api/runs/start", canExecuteWorkflows, async (req, res) => {
  const schema = z.object({
    workflowId: z.string(),
    testMode: z.boolean().optional(),
    inputData: z.any().optional(),
    resumeFromRunId: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  try {
    const testMode = Boolean(parsed.data.testMode);
    const { version } = await getWorkflowDefinitionForRun(prisma, parsed.data.workflowId, testMode);

    let resumePayload: any = {};
    if (parsed.data.resumeFromRunId) {
      const prev = await prisma.run.findUnique({ where: { id: parsed.data.resumeFromRunId } });
      if (prev) {
        const resetNodeStates = resetNodeStatesForResume(prev.nodeStates);
        resumePayload = {
          nodeStates: resetNodeStates,
          context: prev.context,
          logs: prev.logs,
          artifacts: prev.artifacts,
          checkpointNodeId: prev.checkpointNodeId,
          resumeFromRunId: prev.id
        };
      }
    }

    const run = await prisma.run.create({
      data: {
        workflowId: parsed.data.workflowId,
        workflowVersion: version,
        testMode,
        inputData: parsed.data.inputData,
        ...resumePayload
      }
    });

    startRun(prisma, run.id).catch((err) => {
      logger.error("run.start_async_failed", { runId: run.id, error: err });
    });

    observability.incrementCounter("forgeflow_runs_started_total", {
      mode: testMode ? "test" : "prod",
      source: parsed.data.resumeFromRunId ? "resume" : "manual"
    });
    await writeAuditEvent(req, {
      action: "run.start",
      resourceType: "run",
      resourceId: run.id,
      metadata: {
        workflowId: parsed.data.workflowId,
        testMode,
        resumeFromRunId: parsed.data.resumeFromRunId || null
      }
    });
    res.json(run);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "run.start",
      resourceType: "run",
      success: false,
      message: String(error),
      metadata: {
        workflowId: parsed.data.workflowId,
        testMode: Boolean(parsed.data.testMode)
      }
    });
    res.status(400).json({ error: String(error) });
  }
});

app.post("/api/system/preflight", canExecuteWorkflows, async (req, res) => {
  const schema = z.object({
    workflowId: z.string().optional(),
    definition: z.any().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  try {
    if (parsed.data.definition) {
      const result = await preflightForDefinition(parsed.data.definition);
      res.json(result);
      return;
    }
    if (parsed.data.workflowId) {
      const result = await preflightForWorkflowId(prisma, parsed.data.workflowId);
      res.json(result);
      return;
    }
    const result = await preflightForDefinition({ nodes: [], edges: [] });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/workflows/:id/runs", canReadWorkflows, async (req, res) => {
  const runs = await prisma.run.findMany({
    where: { workflowId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  res.json(runs);
});

app.get("/api/runs/:id", canReadWorkflows, async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.id } });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(run);
});

app.post("/api/runs/:id/approve", canApproveWorkflows, async (req, res) => {
  const schema = z.object({ nodeId: z.string(), approved: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const run = await prisma.run.findUnique({ where: { id: req.params.id } });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const context = (run.context || {}) as Record<string, any>;
  context.__approvals = context.__approvals || {};
  context.__approvals[parsed.data.nodeId] = parsed.data.approved;

  await prisma.run.update({
    where: { id: run.id },
    data: {
      context,
      status: parsed.data.approved ? "PENDING" : "FAILED"
    }
  });

  if (parsed.data.approved) {
    startRun(prisma, run.id).catch((err) => logger.error("run.resume_async_failed", { runId: run.id, error: err }));
  }

  observability.incrementCounter("forgeflow_run_approvals_total", {
    approved: parsed.data.approved ? "true" : "false"
  });
  await writeAuditEvent(req, {
    action: "run.approval",
    resourceType: "run",
    resourceId: run.id,
    metadata: {
      nodeId: parsed.data.nodeId,
      approved: parsed.data.approved
    }
  });
  res.json({ ok: true });
});

app.get("/api/runs/:id/diff-last-success", canReadWorkflows, async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.id } });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const prev = await prisma.run.findFirst({
    where: {
      workflowId: run.workflowId,
      status: "SUCCEEDED",
      id: { not: run.id }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!prev) {
    res.json({ hasBaseline: false, changes: [] });
    return;
  }
  res.json(diffRunNodeStates(run as any, prev as any));
});

app.get("/api/metrics/dashboard", canReadMetrics, async (req, res) => {
  const daysRaw = typeof req.query.days === "string" ? Number(req.query.days) : 7;
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.floor(daysRaw))) : 7;
  const timezone = normalizeScheduleTimezone(typeof req.query.timezone === "string" ? req.query.timezone : undefined);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runs = await prisma.run.findMany({
    where: { createdAt: { gte: since } },
    include: { workflow: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000
  });
  const schedules = await listSchedules();
  const activeSchedules = schedules.filter((schedule) => schedule.enabled).length;
  const metrics = buildDashboardMetrics(runs as any, timezone, days);
  const memory = process.memoryUsage();
  const loadAvg = os.loadavg();

  res.json({
    ...metrics,
    schedules: {
      total: schedules.length,
      active: activeSchedules,
      disabled: schedules.length - activeSchedules
    },
    resources: {
      activeRuns: getActiveRunCount(),
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      loadAverage1m: Number(loadAvg[0].toFixed(2)),
      loadAverage5m: Number(loadAvg[1].toFixed(2)),
      loadAverage15m: Number(loadAvg[2].toFixed(2))
    }
  });
});

app.get("/api/admin/users", canManageUsers, async (_req, res) => {
  const users = await listUsers();
  res.json(users);
});

app.post("/api/admin/users", canManageUsers, async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(8),
    role: z.string().optional(),
    disabled: z.boolean().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const user = await createUser(parsed.data);
    await writeAuditEvent(req, {
      action: "user.create",
      resourceType: "user",
      resourceId: user.username,
      metadata: {
        role: user.role,
        disabled: user.disabled
      }
    });
    res.json(user);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "user.create",
      resourceType: "user",
      resourceId: parsed.data.username,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.put("/api/admin/users/:username", canManageUsers, async (req, res) => {
  const schema = z.object({
    role: z.string().optional(),
    password: z.string().min(8).optional(),
    disabled: z.boolean().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const user = await updateUser(req.params.username, parsed.data);
    await writeAuditEvent(req, {
      action: "user.update",
      resourceType: "user",
      resourceId: user.username,
      metadata: {
        role: user.role,
        disabled: user.disabled,
        passwordUpdated: Boolean(parsed.data.password)
      }
    });
    res.json(user);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "user.update",
      resourceType: "user",
      resourceId: req.params.username,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.delete("/api/admin/users/:username", canManageUsers, async (req, res) => {
  try {
    const removed = await deleteUser(req.params.username);
    if (!removed) {
      await writeAuditEvent(req, {
        action: "user.delete",
        resourceType: "user",
        resourceId: req.params.username,
        success: false,
        message: "User not found"
      });
      res.status(404).json({ error: "User not found" });
      return;
    }
    await writeAuditEvent(req, {
      action: "user.delete",
      resourceType: "user",
      resourceId: req.params.username
    });
    res.json({ ok: true });
  } catch (error) {
    await writeAuditEvent(req, {
      action: "user.delete",
      resourceType: "user",
      resourceId: req.params.username,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/admin/roles", canManageRoles, async (_req, res) => {
  const roles = await listRoles();
  res.json(roles);
});

app.put("/api/admin/roles/:role", canManageRoles, async (req, res) => {
  const schema = z.object({
    permissions: z.array(z.string()).min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const role = await upsertRolePermissions(req.params.role, parsed.data.permissions);
    await writeAuditEvent(req, {
      action: "role.update",
      resourceType: "role",
      resourceId: role.role,
      metadata: {
        permissions: role.permissions
      }
    });
    res.json(role);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "role.update",
      resourceType: "role",
      resourceId: req.params.role,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/admin/audit", canReadAudit, async (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;
  const actorUsername = typeof req.query.actorUsername === "string" ? req.query.actorUsername : undefined;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const resourceType = typeof req.query.resourceType === "string" ? req.query.resourceType : undefined;
  const success = toOptionalBoolean(req.query.success);
  const events = await listAuditEvents({
    limit,
    actorUsername,
    action,
    resourceType,
    success
  });
  res.json(events);
});

app.get("/api/webhooks/events", canManageWebhooks, (_req, res) => {
  res.json(listWebhookEventTypes());
});

app.get("/api/webhooks", canManageWebhooks, async (_req, res) => {
  const hooks = await listWebhooks();
  res.json(hooks);
});

app.post("/api/webhooks", canManageWebhooks, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    enabled: z.boolean().optional(),
    secret: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const hook = await createWebhook(parsed.data);
    await writeAuditEvent(req, {
      action: "webhook.create",
      resourceType: "webhook",
      resourceId: hook.id,
      metadata: {
        name: hook.name,
        events: hook.events
      }
    });
    res.json(hook);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "webhook.create",
      resourceType: "webhook",
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.put("/api/webhooks/:id", canManageWebhooks, async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    events: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    secret: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const hook = await updateWebhook(req.params.id, parsed.data);
    await writeAuditEvent(req, {
      action: "webhook.update",
      resourceType: "webhook",
      resourceId: hook.id,
      metadata: parsed.data
    });
    res.json(hook);
  } catch (error) {
    await writeAuditEvent(req, {
      action: "webhook.update",
      resourceType: "webhook",
      resourceId: req.params.id,
      success: false,
      message: String(error)
    });
    res.status(400).json({ error: String(error) });
  }
});

app.delete("/api/webhooks/:id", canManageWebhooks, async (req, res) => {
  const removed = await deleteWebhook(req.params.id);
  if (!removed) {
    await writeAuditEvent(req, {
      action: "webhook.delete",
      resourceType: "webhook",
      resourceId: req.params.id,
      success: false,
      message: "Webhook not found"
    });
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  await writeAuditEvent(req, {
    action: "webhook.delete",
    resourceType: "webhook",
    resourceId: req.params.id
  });
  res.json({ ok: true });
});

app.post("/api/webhooks/:id/test", canManageWebhooks, async (req, res) => {
  const hook = await getWebhook(req.params.id);
  if (!hook) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  const result = await dispatchWebhookTest(hook.id, {
    webhookId: hook.id,
    name: hook.name
  });
  await writeAuditEvent(req, {
    action: "webhook.test",
    resourceType: "webhook",
    resourceId: hook.id,
    metadata: result
  });
  res.json({ ok: true, ...result });
});

app.get("/api/secrets", canReadSecrets, async (_req, res) => {
  const secrets = await listSecrets(prisma);
  res.json(secrets);
});

app.post("/api/secrets", canWriteSecrets, async (req, res) => {
  const schema = z.object({ key: z.string().min(1), value: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    await upsertSecret(prisma, parsed.data.key, parsed.data.value);
    await writeAuditEvent(req, {
      action: "secret.upsert",
      resourceType: "secret",
      resourceId: parsed.data.key,
      metadata: {
        key: parsed.data.key
      }
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error("secret.upsert_failed", { key: parsed.data.key, error: err });
    await writeAuditEvent(req, {
      action: "secret.upsert",
      resourceType: "secret",
      resourceId: parsed.data.key,
      success: false,
      message: String(err),
      metadata: {
        key: parsed.data.key
      }
    });
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/recorders/web/start", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ startUrl: z.string().url().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const session = await startWebRecorder({ startUrl: parsed.data.startUrl });
  res.json(session);
});

app.post("/api/recorders/desktop/start", canWriteWorkflows, async (req, res) => {
  const schema = z.object({ label: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const session = await startDesktopRecording(parsed.data.label);
  res.json(session);
});

app.post("/api/recorders/desktop/stop", canWriteWorkflows, async (_req, res) => {
  const result = await stopDesktopRecording();
  res.json(result);
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
server.listen(port, () => {
  logger.info("server.listening", { port });
  scheduler
    .start()
    .then(() => {
      schedulerReady = true;
      logger.info("scheduler.started");
    })
    .catch((error) => logger.error("scheduler.start_failed", { error }));
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { error });
});
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandled_rejection", { error: reason });
});

async function gracefulShutdown(signal: string) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  let exitCode = 0;
  shutdownPromise = (async () => {
    logger.info("shutdown.received", { signal, timeoutMs: shutdownTimeoutMs });
    scheduler.stop();

    const drained = await waitForActiveRuns(shutdownTimeoutMs);
    if (!drained.drained) {
      exitCode = 1;
      logger.warn("shutdown.active_runs_timeout", { remaining: drained.remaining });
    }

    await Promise.all([
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
      })
    ]);
    await prisma.$disconnect();
    logger.info("shutdown.complete");
  })()
    .catch((error) => {
      exitCode = 1;
      logger.error("shutdown.failed", { error });
    })
    .finally(() => {
      process.exit(exitCode);
    });

  return shutdownPromise;
}

function resetNodeStatesForResume(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const next: Record<string, any> = {};
  for (const key of Object.keys(raw as Record<string, any>)) {
    const current = (raw as Record<string, any>)[key] || {};
    if (current.status === "succeeded") {
      next[key] = current;
      continue;
    }
    next[key] = {
      ...current,
      status: "queued",
      attempts: 0,
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      durationMs: undefined
    };
  }
  return next;
}

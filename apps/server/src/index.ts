import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { signToken, authMiddleware, verifyLogin } from "./lib/auth.js";
import { startWebRecorder, attachRecorderWs } from "./lib/recorder.js";
import { startRun } from "./lib/runner.js";
import { startDesktopRecording, stopDesktopRecording } from "./lib/agent.js";
import {
  getWorkflowDefinitionForRun,
  publishWorkflow,
  rollbackWorkflow,
  saveDraftWorkflow
} from "./lib/workflows.js";
import { listSecrets, upsertSecret } from "./lib/secrets.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: "8mb" }));

attachRecorderWs(wss);

app.use("/recordings", express.static("/recordings"));
app.use("/artifacts", express.static("/app/artifacts"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { username, password } = parsed.data;
  const ok = await verifyLogin(username, password);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials or temporarily locked account" });
    return;
  }
  const token = signToken({ username });
  res.json({ token });
});

app.use(authMiddleware);

app.get("/api/workflows", async (_req, res) => {
  const workflows = await prisma.workflow.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(workflows);
});

app.post("/api/workflows", async (req, res) => {
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
  res.json(workflow);
});

app.put("/api/workflows/:id", async (req, res) => {
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
    res.json(workflow);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post("/api/workflows/:id/publish", async (req, res) => {
  const schema = z.object({ notes: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const published = await publishWorkflow(prisma, req.params.id, parsed.data.notes);
    res.json(published);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/workflows/:id/versions", async (req, res) => {
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId: req.params.id },
    orderBy: { version: "desc" }
  });
  res.json(versions);
});

app.post("/api/workflows/:id/rollback", async (req, res) => {
  const schema = z.object({ version: z.number() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const rolled = await rollbackWorkflow(prisma, req.params.id, parsed.data.version);
    res.json(rolled);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post("/api/runs/start", async (req, res) => {
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
      console.error("Run failed", err);
    });

    res.json(run);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.get("/api/workflows/:id/runs", async (req, res) => {
  const runs = await prisma.run.findMany({
    where: { workflowId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  res.json(runs);
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.id } });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(run);
});

app.post("/api/runs/:id/approve", async (req, res) => {
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
    startRun(prisma, run.id).catch((err) => console.error("Resume failed", err));
  }

  res.json({ ok: true });
});

app.get("/api/runs/:id/diff-last-success", async (req, res) => {
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

  const currentStates = ((run.nodeStates || {}) as any) || {};
  const prevStates = ((prev.nodeStates || {}) as any) || {};

  const allNodeIds = Array.from(new Set([...Object.keys(currentStates), ...Object.keys(prevStates)]));
  const changes = allNodeIds
    .map((nodeId) => {
      const curr = currentStates[nodeId] || {};
      const old = prevStates[nodeId] || {};
      return {
        nodeId,
        statusBefore: old.status,
        statusNow: curr.status,
        durationBefore: old.durationMs,
        durationNow: curr.durationMs,
        changed:
          old.status !== curr.status || Number(old.durationMs || 0) !== Number(curr.durationMs || 0)
      };
    })
    .filter((row) => row.changed);

  res.json({ hasBaseline: true, baselineRunId: prev.id, changes });
});

app.get("/api/secrets", async (_req, res) => {
  const secrets = await listSecrets(prisma);
  res.json(secrets);
});

app.post("/api/secrets", async (req, res) => {
  const schema = z.object({ key: z.string().min(1), value: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  await upsertSecret(prisma, parsed.data.key, parsed.data.value);
  res.json({ ok: true });
});

app.post("/api/recorders/web/start", async (req, res) => {
  const schema = z.object({ startUrl: z.string().url().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const session = await startWebRecorder({ startUrl: parsed.data.startUrl });
  res.json(session);
});

app.post("/api/recorders/desktop/start", async (req, res) => {
  const schema = z.object({ label: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const session = await startDesktopRecording(parsed.data.label);
  res.json(session);
});

app.post("/api/recorders/desktop/stop", async (_req, res) => {
  const result = await stopDesktopRecording();
  res.json(result);
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
server.listen(port, () => {
  console.log(`Server listening on ${port}`);
});

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

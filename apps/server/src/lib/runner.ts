import { mkdir } from "fs/promises";
import path from "path";
import type { PrismaClient, Run } from "@prisma/client";
import { chromium, type Browser, type Page } from "playwright";
import { interpolateWithSecrets } from "./secrets.js";
import {
  deterministicFallback,
  parseJsonOutput,
  validateRecord,
  validateWithSchema
} from "./validation.js";

const agentBaseUrl = process.env.AGENT_BASE_URL || "http://agent:7001";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
const artifactsRoot = process.env.ARTIFACTS_DIR || "/app/artifacts";

export type NodeExecutionStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type NodeState = {
  status: NodeExecutionStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  outputKey?: string;
};

type ExecutionContext = {
  [key: string]: unknown;
  __approvals?: Record<string, boolean>;
  __validationCache?: Record<string, boolean>;
};

class ApprovalRequiredError extends Error {
  nodeId: string;

  constructor(nodeId: string, message: string) {
    super(message);
    this.nodeId = nodeId;
  }
}

class RetryExecutionError extends Error {
  attempts: number;

  constructor(message: string, attempts: number) {
    super(message);
    this.attempts = attempts;
  }
}

export async function startRun(prisma: PrismaClient, runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { workflow: true }
  });
  if (!run) return;

  const definition = await resolveDefinitionForRun(prisma, run);
  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];

  const logs: Array<Record<string, unknown>> = Array.isArray(run.logs) ? (run.logs as any[]) : [];
  const artifacts: Array<Record<string, unknown>> = Array.isArray(run.artifacts)
    ? (run.artifacts as any[])
    : [];

  const context: ExecutionContext = {
    ...(isRecord(run.context) ? (run.context as Record<string, unknown>) : {}),
    ...(isRecord(run.inputData) ? (run.inputData as Record<string, unknown>) : {})
  };
  context.__approvals = (context.__approvals || {}) as Record<string, boolean>;

  const nodeStates: Record<string, NodeState> = initNodeStates(nodes, run.nodeStates);

  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      startedAt: run.startedAt || new Date(),
      nodeStates: toJson(nodeStates),
      context: toJson(context),
      logs: toJson(logs),
      artifacts: toJson(artifacts)
    }
  });

  const graph = buildGraph(nodes, edges);
  let browser: Browser | null = null;
  let page: Page | null = null;
  let checkpointNodeId: string | null = run.checkpointNodeId || null;
  const runStart = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
  const globalTimeoutMs = Number(definition?.execution?.globalTimeoutMs || 30 * 60 * 1000);

  try {
    while (true) {
      if (Date.now() - runStart > globalTimeoutMs) {
        throw new Error(`Global run timeout exceeded (${globalTimeoutMs}ms)`);
      }

      const pendingNodes = nodes.filter((node: any) => {
        const s = nodeStates[node.id]?.status;
        return s !== "succeeded" && s !== "failed" && s !== "skipped";
      });

      if (pendingNodes.length === 0) break;

      let progressed = false;

      for (const node of orderNodes(definition).orderedNodes) {
        const state = nodeStates[node.id];
        if (!state || state.status === "succeeded" || state.status === "failed" || state.status === "skipped") {
          continue;
        }

        const predecessorIds = graph.predecessors[node.id] || [];
        const predecessorStates = predecessorIds.map((id) => nodeStates[id]?.status || "queued");

        const waitingPredecessor = predecessorStates.some((s) => s === "queued" || s === "running");
        if (waitingPredecessor) continue;

        if (predecessorStates.some((s) => s === "failed" || s === "skipped")) {
          state.status = "skipped";
          state.finishedAt = new Date().toISOString();
          logs.push(logEvent(node.id, nodeType(node), "skipped", { reason: "upstream_failed" }));
          progressed = true;
          await persistRunState(prisma, run.id, {
            nodeStates,
            context,
            logs,
            artifacts,
            checkpointNodeId
          });
          continue;
        }

        progressed = true;
        state.status = "running";
        state.startedAt = new Date().toISOString();
        logs.push(logEvent(node.id, nodeType(node), "start"));

        const retryCount = Number(node.data?.retryCount ?? definition?.execution?.defaultRetries ?? 2);
        const timeoutMs = Number(node.data?.timeoutMs ?? definition?.execution?.defaultNodeTimeoutMs ?? 30_000);

        try {
          const { outputKey, attempts } = await runNodeWithRetry({
            prisma,
            node,
            context,
            retryCount,
            timeoutMs,
            browser,
            page,
            setBrowserAndPage: (b, p) => {
              browser = b;
              page = p;
            },
            runId: run.id,
            artifacts,
            logs,
            testMode: Boolean(run.testMode)
          });

          state.status = "succeeded";
          state.attempts = attempts;
          state.finishedAt = new Date().toISOString();
          state.durationMs = state.startedAt
            ? Date.now() - new Date(state.startedAt).getTime()
            : undefined;
          if (outputKey) state.outputKey = outputKey;

          logs.push(logEvent(node.id, nodeType(node), "done", { durationMs: state.durationMs }));

          await persistRunState(prisma, run.id, {
            nodeStates,
            context,
            logs,
            artifacts,
            checkpointNodeId: node.id
          });
          checkpointNodeId = node.id;
        } catch (error) {
          if (error instanceof ApprovalRequiredError) {
            state.status = "queued";
            logs.push(logEvent(node.id, nodeType(node), "waiting_approval", { message: error.message }));
            await prisma.run.update({
              where: { id: run.id },
              data: {
                status: "WAITING_APPROVAL",
                nodeStates: toJson(nodeStates),
                context: toJson(context),
                logs: toJson(logs),
                artifacts: toJson(artifacts),
                checkpointNodeId
              }
            });
            return;
          }

          state.status = "failed";
          state.error = String(error);
          state.attempts =
            typeof (error as any)?.attempts === "number"
              ? Number((error as any).attempts)
              : retryCount + 1;
          state.finishedAt = new Date().toISOString();
          state.durationMs = state.startedAt
            ? Date.now() - new Date(state.startedAt).getTime()
            : undefined;
          logs.push(logEvent(node.id, nodeType(node), "failed", { error: String(error) }));
          await persistRunState(prisma, run.id, {
            nodeStates,
            context,
            logs,
            artifacts,
            checkpointNodeId
          });
        }
      }

      if (!progressed) {
        // Cycles or broken dependencies: fail remaining nodes deterministically.
        for (const node of pendingNodes) {
          const state = nodeStates[node.id];
          state.status = "failed";
          state.error = "Unresolvable dependency or cycle";
          state.finishedAt = new Date().toISOString();
          logs.push(logEvent(node.id, nodeType(node), "failed", { error: state.error }));
        }
        break;
      }
    }

    const failedCount = Object.values(nodeStates).filter((s) => s.status === "failed").length;
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 ? "FAILED" : "SUCCEEDED",
        finishedAt: new Date(),
        nodeStates: toJson(nodeStates),
        context: toJson(context),
        logs: toJson(logs),
        artifacts: toJson(artifacts)
      }
    });
  } catch (error) {
    logs.push(logEvent("run", "run", "failed", { error: String(error) }));
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        nodeStates: toJson(nodeStates),
        context: toJson(context),
        logs: toJson(logs),
        artifacts: toJson(artifacts)
      }
    });
  } finally {
    if (browser) await (browser as any).close();
  }
}

async function runNodeWithRetry(args: {
  prisma: PrismaClient;
  node: any;
  context: ExecutionContext;
  retryCount: number;
  timeoutMs: number;
  browser: Browser | null;
  page: Page | null;
  setBrowserAndPage: (browser: Browser | null, page: Page | null) => void;
  runId: string;
  artifacts: Array<Record<string, unknown>>;
  logs: Array<Record<string, unknown>>;
  testMode: boolean;
}) {
  const {
    prisma,
    node,
    context,
    retryCount,
    timeoutMs,
    browser: initialBrowser,
    page: initialPage,
    setBrowserAndPage,
    runId,
    artifacts,
    logs,
    testMode
  } = args;

  let lastError: unknown;
  let stateAttempts = 0;
  let currentBrowser = initialBrowser;
  let currentPage = initialPage;

  for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
    stateAttempts = attempt;
    try {
      const result = await withTimeout(
        executeNode({
          prisma,
          node,
          context,
          browser: currentBrowser,
          page: currentPage,
          setBrowserAndPage: (b, p) => {
            currentBrowser = b;
            currentPage = p;
            setBrowserAndPage(b, p);
          },
          testMode
        }),
        timeoutMs,
        `Node ${node.id} timed out`
      );
      return { ...result, attempts: stateAttempts };
    } catch (error) {
      if (error instanceof ApprovalRequiredError) {
        throw error;
      }
      lastError = error;
      logs.push(logEvent(node.id, nodeType(node), "retry_error", { attempt, error: String(error) }));
      if (currentPage) {
        const failureArtifacts = await captureFailureArtifacts(runId, node.id, currentPage, attempt, error);
        artifacts.push(...failureArtifacts);
      }
      if (attempt <= retryCount) {
        const backoffMs = 250 * Math.pow(2, attempt - 1);
        logs.push(logEvent(node.id, nodeType(node), "retrying", { attempt, backoffMs }));
        await sleep(backoffMs);
      }
    }
  }

  throw new RetryExecutionError(String(lastError), stateAttempts);
}

async function executeNode(args: {
  prisma: PrismaClient;
  node: any;
  context: ExecutionContext;
  browser: Browser | null;
  page: Page | null;
  setBrowserAndPage: (browser: Browser | null, page: Page | null) => void;
  testMode: boolean;
}): Promise<{ outputKey?: string }> {
  const { prisma, node, context, browser, page, setBrowserAndPage, testMode } = args;
  const nodeTypeValue = nodeType(node);

  switch (nodeTypeValue) {
    case "start":
      return {};
    case "set_variable": {
      const key = String(node.data?.key || "");
      if (!key) throw new Error("set_variable missing key");
      context[key] = await interpolateWithSecrets(node.data?.value, context, prisma);
      return { outputKey: key };
    }
    case "http_request": {
      await runHttp(prisma, node.data, context);
      return { outputKey: node.data?.saveAs };
    }
    case "transform_llm": {
      await runLlm(node.data, context);
      return { outputKey: node.data?.outputKey };
    }
    case "validate_record": {
      const input = context[node.data?.inputKey];
      const result = validateRecord(input, node.data || {});
      if (!result.ok) {
        throw new Error(`Record validation failed: ${result.errors.join("; ")}`);
      }
      const uniqueBy = Array.isArray(node.data?.uniqueBy) ? node.data.uniqueBy : [];
      if (uniqueBy.length && input && typeof input === "object" && !Array.isArray(input)) {
        const key = uniqueBy.map((field: string) => String((input as Record<string, unknown>)[field] || "")).join("|");
        const cacheKey = `${node.id}:${key}`;
        context.__validationCache = context.__validationCache || {};
        if (context.__validationCache[cacheKey]) {
          throw new Error(`Duplicate record detected for unique key ${key}`);
        }
        context.__validationCache[cacheKey] = true;
      }
      return {};
    }
    case "submit_guard": {
      const key = String(node.data?.inputKey || "");
      const value = key ? context[key] : context;
      const schemaResult = validateWithSchema(value, node.data?.schema);
      if (!schemaResult.ok) {
        throw new Error(`Submit guard failed: ${schemaResult.errors.join("; ")}`);
      }
      return {};
    }
    case "manual_approval": {
      const approvals = context.__approvals || {};
      if (testMode && node.data?.autoApproveInTestMode !== false) {
        approvals[node.id] = true;
        context.__approvals = approvals;
        return {};
      }
      if (approvals[node.id]) return {};
      throw new ApprovalRequiredError(node.id, node.data?.message || "Manual approval required");
    }
    case "playwright_navigate": {
      const ensured = await ensurePage(browser, page);
      setBrowserAndPage(ensured.browser, ensured.page);
      const url = await interpolateWithSecrets(node.data?.url, context, prisma);
      await ensured.page.goto(String(url));
      return {};
    }
    case "playwright_click": {
      const ensured = await ensurePage(browser, page);
      setBrowserAndPage(ensured.browser, ensured.page);
      await clickWithSelectorStrategies(ensured.page, node.data);
      return {};
    }
    case "playwright_fill": {
      const ensured = await ensurePage(browser, page);
      setBrowserAndPage(ensured.browser, ensured.page);
      const value = String(await interpolateWithSecrets(node.data?.value, context, prisma));
      await fillWithSelectorStrategies(ensured.page, node.data, value);
      return {};
    }
    case "playwright_extract": {
      const ensured = await ensurePage(browser, page);
      setBrowserAndPage(ensured.browser, ensured.page);
      const saveAs = String(node.data?.saveAs || "extracted_text");
      const value = await extractWithSelectorStrategies(ensured.page, node.data);
      context[saveAs] = value;
      return { outputKey: saveAs };
    }
    case "desktop_click":
    case "desktop_click_image":
    case "desktop_type":
    case "desktop_wait_for_image": {
      await runDesktop(nodeTypeValue, node.data, context, prisma);
      return {};
    }
    default:
      return {};
  }
}

async function runHttp(prisma: PrismaClient, data: any, context: ExecutionContext) {
  const url = String(await interpolateWithSecrets(data?.url, context, prisma));
  const method = String(data?.method || "GET").toUpperCase();
  const headers = (data?.headers || {}) as Record<string, string>;
  const body = data?.body ? await resolveTemplateObject(data.body, context, prisma) : undefined;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();

  if (data?.saveAs) {
    context[data.saveAs] = payload;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${method} ${url} failed with status ${res.status}`);
  }
}

async function runLlm(data: any, context: ExecutionContext) {
  const input = context[data?.inputKey];
  const strictJson = Boolean(data?.strictJson ?? true);
  const outputSchema = data?.outputSchema;

  const prompt = [
    data?.prompt || "Clean and normalize the data.",
    strictJson
      ? "Return only valid JSON that conforms to the required schema. No prose."
      : "Return cleaned output.",
    "Input:",
    typeof input === "string" ? input : JSON.stringify(input)
  ].join("\n\n");

  const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: data?.model || "llama3.2", prompt, stream: false })
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status}`);
  }

  const json = await res.json();
  const rawText = String(json.response || json.output || "");

  let output: unknown = rawText;
  if (strictJson) {
    try {
      output = parseJsonOutput(rawText);
      const result = validateWithSchema(output, outputSchema);
      if (!result.ok) {
        throw new Error(result.errors.join("; "));
      }
    } catch {
      output = deterministicFallback(input, outputSchema, data?.fallbackMode || "pick_object");
      const fallbackValidation = validateWithSchema(output, outputSchema);
      if (!fallbackValidation.ok) {
        throw new Error(`LLM output and fallback failed schema validation: ${fallbackValidation.errors.join("; ")}`);
      }
    }
  }

  context[data?.outputKey || "llm_output"] = output;
}

async function runDesktop(type: string, data: any, context: ExecutionContext, prisma: PrismaClient) {
  const payload = await resolveTemplateObject(data || {}, context, prisma);
  const res = await fetch(`${agentBaseUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, data: payload })
  });
  if (!res.ok) {
    throw new Error(`Desktop agent action failed: ${res.status}`);
  }
  const body = await res.json();
  if (body?.ok === false) {
    throw new Error(body.error || "Desktop action failed");
  }
}

async function ensurePage(browser: Browser | null, page: Page | null) {
  if (!browser) browser = await chromium.launch({ headless: false });
  if (!page) {
    const context = await browser.newContext();
    page = await context.newPage();
  }
  return { browser, page };
}

async function clickWithSelectorStrategies(page: Page, data: any) {
  const candidates = buildSelectorCandidates(data);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      await clickCandidate(page, candidate);
      return;
    } catch (error) {
      errors.push(String(error));
    }
  }

  const suggestion = await suggestSelector(page, data);
  throw new Error(`Click failed. ${errors.join(" | ")} ${suggestion ? `Suggestion: ${suggestion}` : ""}`);
}

async function fillWithSelectorStrategies(page: Page, data: any, value: string) {
  const candidates = buildSelectorCandidates(data);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      await fillCandidate(page, candidate, value);
      return;
    } catch (error) {
      errors.push(String(error));
    }
  }

  const suggestion = await suggestSelector(page, data);
  throw new Error(`Fill failed. ${errors.join(" | ")} ${suggestion ? `Suggestion: ${suggestion}` : ""}`);
}

async function extractWithSelectorStrategies(page: Page, data: any) {
  const candidates = buildSelectorCandidates(data);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await extractCandidate(page, candidate);
    } catch (error) {
      errors.push(String(error));
    }
  }

  const suggestion = await suggestSelector(page, data);
  throw new Error(`Extract failed. ${errors.join(" | ")} ${suggestion ? `Suggestion: ${suggestion}` : ""}`);
}

export function buildSelectorCandidates(data: any): any[] {
  const candidates: any[] = [];
  if (Array.isArray(data?.selectors)) {
    for (const selector of data.selectors) {
      candidates.push({ kind: "css", selector });
    }
  }
  if (data?.testId) candidates.push({ kind: "css", selector: `[data-testid="${data.testId}"]` });
  if (data?.ariaLabel) candidates.push({ kind: "css", selector: `[aria-label="${data.ariaLabel}"]` });
  if (data?.role && data?.name) candidates.push({ kind: "role", role: data.role, name: data.name });
  if (data?.selector) candidates.push({ kind: "css", selector: data.selector });
  if (data?.xpath) candidates.push({ kind: "xpath", selector: data.xpath });
  return candidates;
}

async function clickCandidate(page: Page, candidate: any) {
  if (candidate.kind === "role") {
    await page.getByRole(candidate.role as any, { name: String(candidate.name) }).click({ timeout: 3000 });
    return;
  }
  if (candidate.kind === "xpath") {
    await page.locator(`xpath=${candidate.selector}`).first().click({ timeout: 3000 });
    return;
  }
  await page.locator(candidate.selector).first().click({ timeout: 3000 });
}

async function fillCandidate(page: Page, candidate: any, value: string) {
  if (candidate.kind === "role") {
    await page.getByRole(candidate.role as any, { name: String(candidate.name) }).fill(value, { timeout: 3000 });
    return;
  }
  if (candidate.kind === "xpath") {
    await page.locator(`xpath=${candidate.selector}`).first().fill(value, { timeout: 3000 });
    return;
  }
  await page.locator(candidate.selector).first().fill(value, { timeout: 3000 });
}

async function extractCandidate(page: Page, candidate: any) {
  if (candidate.kind === "role") {
    return page.getByRole(candidate.role as any, { name: String(candidate.name) }).first().textContent({ timeout: 3000 });
  }
  if (candidate.kind === "xpath") {
    return page.locator(`xpath=${candidate.selector}`).first().textContent({ timeout: 3000 });
  }
  return page.locator(candidate.selector).first().textContent({ timeout: 3000 });
}

async function suggestSelector(page: Page, data: any) {
  if (data?.textHint) {
    const found = await page.locator(`text=${data.textHint}`).first().count();
    if (found > 0) {
      return `Use text selector: text=${data.textHint}`;
    }
  }

  const hints = await page
    .evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button,[role='button'],a"))
        .slice(0, 6)
        .map((el) => ({
          text: (el.textContent || "").trim(),
          testId: el.getAttribute("data-testid"),
          ariaLabel: el.getAttribute("aria-label")
        }));
      return buttons;
    })
    .catch(() => []);

  const first = (hints || []).find((h: any) => h.testId || h.ariaLabel || h.text);
  if (!first) return "";

  if (first.testId) return `[data-testid=\"${first.testId}\"]`;
  if (first.ariaLabel) return `[aria-label=\"${first.ariaLabel}\"]`;
  if (first.text) return `text=${first.text}`;
  return "";
}

async function resolveTemplateObject(value: any, context: ExecutionContext, prisma: PrismaClient): Promise<any> {
  if (Array.isArray(value)) {
    const out: any[] = [];
    for (const item of value) {
      out.push(await resolveTemplateObject(item, context, prisma));
    }
    return out;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = await resolveTemplateObject(value[key], context, prisma);
    }
    return out;
  }
  return interpolateWithSecrets(value, context, prisma);
}

async function captureFailureArtifacts(
  runId: string,
  nodeId: string,
  page: Page,
  attempt: number,
  error: unknown
) {
  const artifacts: Array<Record<string, unknown>> = [];
  const dir = path.join(artifactsRoot, runId);
  await mkdir(dir, { recursive: true });

  const stamp = Date.now();
  const screenshotName = `${nodeId}_attempt${attempt}_${stamp}.png`;
  const domName = `${nodeId}_attempt${attempt}_${stamp}.html`;
  const screenshotPath = path.join(dir, screenshotName);
  const domPath = path.join(dir, domName);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  const html = await page.content().catch(() => "");

  if (html) {
    const fs = await import("fs/promises");
    await fs.writeFile(domPath, html, "utf8").catch(() => undefined);
  }

  artifacts.push({
    nodeId,
    type: "screenshot",
    path: screenshotPath,
    attempt,
    createdAt: new Date().toISOString(),
    error: String(error)
  });

  if (html) {
    artifacts.push({
      nodeId,
      type: "dom_snapshot",
      path: domPath,
      attempt,
      createdAt: new Date().toISOString()
    });
  }

  return artifacts;
}

async function resolveDefinitionForRun(prisma: PrismaClient, run: Run & { workflow: any }) {
  if (run.workflowVersion) {
    const version = await prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId: run.workflowId, version: run.workflowVersion } }
    });
    if (version?.definition) {
      return version.definition as any;
    }
  }

  if (run.testMode) {
    return (run.workflow.draftDefinition ?? run.workflow.definition ?? run.workflow.publishedDefinition) as any;
  }

  return (run.workflow.publishedDefinition ?? run.workflow.definition ?? run.workflow.draftDefinition) as any;
}

function initNodeStates(nodes: any[], existing: unknown) {
  const out: Record<string, NodeState> = isRecord(existing) ? ({ ...(existing as Record<string, NodeState>) } as any) : {};
  for (const node of nodes) {
    if (!out[node.id]) {
      out[node.id] = { status: "queued", attempts: 0 };
    }
  }
  return out;
}

function buildGraph(nodes: any[], edges: any[]) {
  const predecessors: Record<string, string[]> = {};
  const successors: Record<string, string[]> = {};

  for (const node of nodes) {
    predecessors[node.id] = [];
    successors[node.id] = [];
  }

  for (const edge of edges) {
    if (!predecessors[edge.target]) predecessors[edge.target] = [];
    if (!successors[edge.source]) successors[edge.source] = [];
    predecessors[edge.target].push(edge.source);
    successors[edge.source].push(edge.target);
  }

  return { predecessors, successors };
}

async function persistRunState(
  prisma: PrismaClient,
  runId: string,
  data: {
    nodeStates: Record<string, NodeState>;
    context: ExecutionContext;
    logs: Array<Record<string, unknown>>;
    artifacts: Array<Record<string, unknown>>;
    checkpointNodeId?: string | null;
  }
) {
  await prisma.run.update({
    where: { id: runId },
    data: {
      nodeStates: toJson(data.nodeStates),
      context: toJson(data.context),
      logs: toJson(data.logs),
      artifacts: toJson(data.artifacts),
      checkpointNodeId: data.checkpointNodeId || null
    }
  });
}

function logEvent(nodeId: string, type: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    ts: new Date().toISOString(),
    nodeId,
    type,
    status,
    ...extra
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nodeType(node: any) {
  return String(node?.data?.type || node?.type || "unknown");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutRef: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutRef = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutRef) clearTimeout(timeoutRef);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toJson(value: unknown) {
  return value as any;
}

export function orderNodes(definition: any) {
  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];
  const incoming = new Map<string, number>();
  const byId = new Map(nodes.map((n: any) => [n.id, n]));

  for (const node of nodes) incoming.set(node.id, 0);
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  }

  const queue: any[] = [];
  for (const node of nodes) {
    if ((incoming.get(node.id) || 0) === 0) queue.push(node);
  }

  const ordered: any[] = [];
  while (queue.length) {
    const node = queue.shift();
    ordered.push(node);
    for (const edge of edges.filter((e: any) => e.source === node.id)) {
      incoming.set(edge.target, (incoming.get(edge.target) || 0) - 1);
      if ((incoming.get(edge.target) || 0) === 0) {
        const target = byId.get(edge.target);
        if (target) queue.push(target);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    // Preserve deterministic behavior even with cycles.
    const seen = new Set(ordered.map((n: any) => n.id));
    const remaining = nodes.filter((n: any) => !seen.has(n.id));
    ordered.push(...remaining);
  }

  return { orderedNodes: ordered };
}

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
import { dispatchWebhookEvent } from "./webhooks.js";

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
  __branches?: Record<string, { result: boolean; targetId?: string; evaluatedAt: string }>;
  __loopMeta?: Record<string, { count: number; itemKey: string; indexKey: string; outputKey: string }>;
};

type ExecutionDefaults = {
  playwrightHeadless?: boolean;
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

const activeRuns = new Set<string>();

export function getActiveRunCount() {
  return activeRuns.size;
}

export async function waitForActiveRuns(timeoutMs = 30_000) {
  const started = Date.now();
  while (activeRuns.size > 0 && Date.now() - started < timeoutMs) {
    await sleep(250);
  }
  return { drained: activeRuns.size === 0, remaining: activeRuns.size };
}

export async function startRun(prisma: PrismaClient, runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { workflow: true }
  });
  if (!run) return;
  activeRuns.add(run.id);

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
  void safeDispatchWebhook("run.started", {
    runId: run.id,
    workflowId: run.workflowId,
    workflowVersion: run.workflowVersion,
    testMode: run.testMode
  });

  const graph = buildGraph(nodes, edges);
  const nodesById: Map<string, any> = new Map(
    nodes.map((node: any) => [String(node.id), node] as [string, any])
  );
  let browser: Browser | null = null;
  let page: Page | null = null;
  let checkpointNodeId: string | null = run.checkpointNodeId || null;
  const runStart = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
  const globalTimeoutMs = Number(definition?.execution?.globalTimeoutMs || 5 * 60 * 1000); // Default to 5m instead of 30m

  try {
    while (true) {
      if (Date.now() - runStart > globalTimeoutMs) {
        console.log(`[Runner] Global run timeout exceeded for run ${run.id}`);
        throw new Error(`Global run timeout exceeded (${globalTimeoutMs}ms)`);
      }

      console.log(`[Runner] Loop iteration for run ${run.id}. Node states:`, Object.fromEntries(Object.entries(nodeStates).map(([id, s]) => [id, s.status])));

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

        if (shouldSkipByConditionalBranch(node.id, graph, nodesById, nodeStates, context)) {
          state.status = "skipped";
          state.finishedAt = new Date().toISOString();
          logs.push(logEvent(node.id, nodeType(node), "skipped", { reason: "branch_not_selected" }));
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
        console.log(`[Runner] Starting node ${node.id} (${nodeType(node)})`);
        logs.push(logEvent(node.id, nodeType(node), "start"));

        const retryCount = Number(node.data?.retryCount ?? definition?.execution?.defaultRetries ?? 2);
        const timeoutMs = Number(node.data?.timeoutMs ?? definition?.execution?.defaultNodeTimeoutMs ?? 10_000); // Default to 10s instead of 30s

        try {
          const { outputKey, attempts } = await runNodeWithRetry({
            prisma,
            node,
            context,
            executionDefaults: definition?.execution,
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
            void safeDispatchWebhook("run.waiting_approval", {
              runId: run.id,
              workflowId: run.workflowId,
              nodeId: node.id
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
    const finalStatus = failedCount > 0 ? "FAILED" : "SUCCEEDED";
    console.log(`[Runner] Finishing run ${run.id} with status: ${finalStatus}`);
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        nodeStates: toJson(nodeStates),
        context: toJson(context),
        logs: toJson(logs),
        artifacts: toJson(artifacts)
      }
    });
    void safeDispatchWebhook(finalStatus === "SUCCEEDED" ? "run.succeeded" : "run.failed", {
      runId: run.id,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: finalStatus,
      failedNodes: Object.entries(nodeStates)
        .filter(([, state]) => state.status === "failed")
        .map(([nodeId, state]) => ({ nodeId, error: state.error || "" }))
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
    void safeDispatchWebhook("run.failed", {
      runId: run.id,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: "FAILED",
      error: String(error)
    });
  } finally {
    if (browser) {
      console.log(`[Runner] Closing browser for run ${run.id}...`);
      await (browser as any).close();
      console.log(`[Runner] Browser closed for run ${run.id}.`);
    }
    activeRuns.delete(run.id);
    console.log(`[Runner] startRun finished for ${run.id}`);
  }
}

function safeDispatchWebhook(
  event: "run.started" | "run.succeeded" | "run.failed" | "run.waiting_approval",
  payload: Record<string, unknown>
) {
  return dispatchWebhookEvent(event, payload).catch((error) => {
    console.error(`[Webhooks] dispatch failed for ${event}`, error);
  });
}

async function runNodeWithRetry(args: {
  prisma: PrismaClient;
  node: any;
  context: ExecutionContext;
  executionDefaults?: ExecutionDefaults;
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
    executionDefaults,
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
          executionDefaults,
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
      console.error(`[Runner] Error in node ${node.id} (attempt ${attempt}):`, error);
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
  executionDefaults?: ExecutionDefaults;
  browser: Browser | null;
  page: Page | null;
  setBrowserAndPage: (browser: Browser | null, page: Page | null) => void;
  testMode: boolean;
}): Promise<{ outputKey?: string }> {
  const { prisma, node, context, executionDefaults, browser, page, setBrowserAndPage, testMode } = args;
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
    case "conditional_branch": {
      const left = resolveConditionalOperand(node.data, context);
      const right = node.data?.right;
      const operator = String(node.data?.operator || "truthy");
      const result = evaluateCondition(left, right, operator);
      const targetId = result ? asNonEmptyString(node.data?.trueTarget) : asNonEmptyString(node.data?.falseTarget);
      context.__branches = context.__branches || {};
      context.__branches[node.id] = {
        result,
        targetId: targetId || undefined,
        evaluatedAt: new Date().toISOString()
      };
      if (node.data?.outputKey) {
        context[String(node.data.outputKey)] = result;
      }
      return { outputKey: node.data?.outputKey };
    }
    case "loop_iterate": {
      const inputKey = String(node.data?.inputKey || "");
      if (!inputKey) throw new Error("loop_iterate missing inputKey");
      const value = context[inputKey];
      if (!Array.isArray(value)) {
        throw new Error(`loop_iterate expected array at context.${inputKey}`);
      }
      const itemKey = String(node.data?.itemKey || "loopItem");
      const indexKey = String(node.data?.indexKey || "loopIndex");
      const outputKey = String(node.data?.outputKey || `${inputKey}_items`);
      context[outputKey] = value;
      context[itemKey] = value.length ? value[0] : null;
      context[indexKey] = value.length ? 0 : -1;
      context.__loopMeta = context.__loopMeta || {};
      context.__loopMeta[node.id] = { count: value.length, itemKey, indexKey, outputKey };
      return { outputKey };
    }
    case "parallel_execute": {
      const tasks = Array.isArray(node.data?.tasks) ? node.data.tasks : [];
      if (!tasks.length) {
        throw new Error("parallel_execute requires at least one task");
      }
      const outputKey = String(node.data?.outputKey || "parallelResult");
      const allowPartial = Boolean(node.data?.allowPartial);
      const taskTimeoutMs = Number(node.data?.taskTimeoutMs || 15_000);

      const results = await Promise.allSettled(
        tasks.map(async (task: any, idx: number) => {
          const taskId = String(task?.id || `task-${idx + 1}`);
          const taskType = String(task?.type || "http_request");

          if (taskType === "http_request") {
            await withTimeout(
              runHttp(prisma, task, context),
              taskTimeoutMs,
              `parallel_execute task ${taskId} timed out`
            );
            return {
              taskId,
              taskType,
              status: "succeeded" as const,
              outputKey: task?.saveAs ? String(task.saveAs) : undefined
            };
          }

          if (taskType === "set_variable") {
            const key = String(task?.key || "");
            if (!key) throw new Error(`parallel_execute task ${taskId} missing key`);
            context[key] = await interpolateWithSecrets(task?.value, context, prisma);
            return {
              taskId,
              taskType,
              status: "succeeded" as const,
              outputKey: key
            };
          }

          if (taskType === "transform_llm") {
            const llmOutputKey = String(task?.outputKey || "");
            if (!llmOutputKey) {
              throw new Error(`parallel_execute task ${taskId} missing outputKey`);
            }
            await withTimeout(
              runLlm(task, context),
              taskTimeoutMs,
              `parallel_execute task ${taskId} timed out`
            );
            return {
              taskId,
              taskType,
              status: "succeeded" as const,
              outputKey: llmOutputKey
            };
          }

          throw new Error(`parallel_execute task ${taskId} has unsupported type "${taskType}"`);
        })
      );

      const summary = results.map((result, idx) => {
        const taskId = String(tasks[idx]?.id || `task-${idx + 1}`);
        const taskType = String(tasks[idx]?.type || "http_request");
        if (result.status === "fulfilled") {
          return result.value;
        }
        return {
          taskId,
          taskType,
          status: "failed" as const,
          error: String(result.reason)
        };
      });

      const failed = summary.filter((item) => item.status === "failed");
      context[outputKey] = summary;
      if (failed.length && !allowPartial) {
        throw new Error(
          `parallel_execute failed ${failed.length}/${summary.length} tasks (${failed
            .map((item) => String(item.taskId))
            .join(", ")})`
        );
      }
      return { outputKey };
    }
    case "playwright_navigate": {
      const headless = resolvePlaywrightHeadless(node, executionDefaults);
      const ensured = await ensurePage(browser, page, headless);
      setBrowserAndPage(ensured.browser, ensured.page);
      const url = await interpolateWithSecrets(node.data?.url, context, prisma);
      await ensured.page.goto(String(url));
      return {};
    }
    case "playwright_click": {
      const headless = resolvePlaywrightHeadless(node, executionDefaults);
      const ensured = await ensurePage(browser, page, headless);
      setBrowserAndPage(ensured.browser, ensured.page);
      await clickWithSelectorStrategies(ensured.page, node.data);
      return {};
    }
    case "playwright_fill": {
      const headless = resolvePlaywrightHeadless(node, executionDefaults);
      const ensured = await ensurePage(browser, page, headless);
      setBrowserAndPage(ensured.browser, ensured.page);
      const value = String(await interpolateWithSecrets(node.data?.value, context, prisma));
      await fillWithSelectorStrategies(ensured.page, node.data, value);
      return {};
    }
    case "playwright_extract": {
      const headless = resolvePlaywrightHeadless(node, executionDefaults);
      const ensured = await ensurePage(browser, page, headless);
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

async function ensurePage(browser: Browser | null, page: Page | null, headless: boolean) {
  console.log(`[Runner] ensurePage: headless=${headless}`);
  if (!browser) {
    console.log(`[Runner] Launching browser (headless=${headless})...`);
    try {
      browser = await chromium.launch({
        headless,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
      console.log(`[Runner] Browser launched.`);
    } catch (launchError) {
      console.error(`[Runner] Failed to launch browser:`, launchError);
      throw launchError;
    }
  }
  if (!page) {
    const context = await browser.newContext();
    page = await context.newPage();
  }
  return { browser, page };
}

function envPlaywrightHeadlessDefault() {
  const raw = String(process.env.PLAYWRIGHT_HEADLESS ?? "true").toLowerCase().trim();
  return !(raw === "0" || raw === "false" || raw === "no");
}

export function resolvePlaywrightHeadless(node: any, executionDefaults?: ExecutionDefaults) {
  if (typeof node?.data?.headless === "boolean") return node.data.headless;
  if (typeof executionDefaults?.playwrightHeadless === "boolean") {
    return executionDefaults.playwrightHeadless;
  }
  return envPlaywrightHeadlessDefault();
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
      const buttons = Array.from(
        document.querySelectorAll("button,[role='button'],a,input,textarea,select,[data-testid],[aria-label]")
      )
        .slice(0, 12)
        .map((el) => ({
          text: (el.textContent || "").trim(),
          testId: el.getAttribute("data-testid"),
          ariaLabel: el.getAttribute("aria-label"),
          id: el.getAttribute("id"),
          role: el.getAttribute("role"),
          tag: el.tagName.toLowerCase()
        }));
      return buttons;
    })
    .catch(() => []);

  if (selectorAiEnabled()) {
    const aiSelectors = await requestSelectorSuggestionsFromLlm(data, hints).catch(() => []);
    if (aiSelectors.length) {
      return `Try selectors: ${aiSelectors.join(" | ")}`;
    }
  }

  const first = (hints || []).find((h: any) => h.testId || h.ariaLabel || h.text);
  if (!first) return "";

  if (first.testId) return `[data-testid=\"${first.testId}\"]`;
  if (first.ariaLabel) return `[aria-label=\"${first.ariaLabel}\"]`;
  if (first.text) return `text=${first.text}`;
  return "";
}

function selectorAiEnabled() {
  const raw = String(process.env.SELECTOR_AI_ENABLED ?? "true").toLowerCase().trim();
  return !(raw === "0" || raw === "false" || raw === "no");
}

async function requestSelectorSuggestionsFromLlm(data: any, hints: Array<Record<string, unknown>>) {
  const model = String(data?.selectorModel || process.env.SELECTOR_AI_MODEL || "llama3.2");
  const prompt = buildSelectorAiPrompt(data, hints);
  const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    }),
    signal: AbortSignal.timeout(2500)
  });
  if (!response.ok) {
    throw new Error(`Selector AI request failed: ${response.status}`);
  }
  const body = await response.json();
  const rawText = String(body.response || body.output || "");
  return extractSelectorsFromAiResponse(rawText);
}

export function buildSelectorAiPrompt(data: any, hints: Array<Record<string, unknown>>) {
  const requestedAction = data?.value !== undefined ? "fill input field" : "click/locate element";
  const requestedSelector = String(data?.selector || data?.textHint || "");
  const sanitizedHints = (hints || []).slice(0, 10);
  return [
    "You are a browser automation selector expert.",
    `Goal: provide resilient selector candidates for this action: ${requestedAction}.`,
    requestedSelector ? `Current failing selector: ${requestedSelector}` : "No current selector available.",
    "Return ONLY JSON with this shape: {\"selectors\": [\"...\", \"...\"]}.",
    "Prefer data-testid, aria-label, role+name, and stable attributes. Avoid nth-child when possible.",
    "DOM hints:",
    JSON.stringify(sanitizedHints)
  ].join("\n");
}

export function extractSelectorsFromAiResponse(raw: string) {
  const fromJson = extractSelectorsFromJson(raw);
  if (fromJson.length) return fromJson;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .filter(Boolean);

  return normalizeSelectors(lines);
}

function extractSelectorsFromJson(raw: string) {
  try {
    const parsed = parseJsonOutput(raw);
    if (Array.isArray(parsed)) {
      return normalizeSelectors(parsed);
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>).selectors;
      if (Array.isArray(value)) {
        return normalizeSelectors(value);
      }
    }
  } catch {
    // ignore parse errors and fall back to line parsing
  }
  return [];
}

function normalizeSelectors(values: unknown[]) {
  const selectors = Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => value.replace(/^selectors?\s*:\s*/i, ""))
        .filter((value) =>
          value.startsWith("#") ||
          value.startsWith(".") ||
          value.startsWith("[") ||
          value.startsWith("//") ||
          value.startsWith("xpath=") ||
          value.startsWith("text=") ||
          value.includes("[data-testid") ||
          value.includes("[aria-label") ||
          value.includes("button") ||
          value.includes("input")
        )
    )
  );
  return selectors.slice(0, 6);
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
  const incomingEdges: Record<string, any[]> = {};
  const outgoingEdges: Record<string, any[]> = {};

  for (const node of nodes) {
    predecessors[node.id] = [];
    successors[node.id] = [];
    incomingEdges[node.id] = [];
    outgoingEdges[node.id] = [];
  }

  for (const edge of edges) {
    if (!predecessors[edge.target]) predecessors[edge.target] = [];
    if (!successors[edge.source]) successors[edge.source] = [];
    if (!incomingEdges[edge.target]) incomingEdges[edge.target] = [];
    if (!outgoingEdges[edge.source]) outgoingEdges[edge.source] = [];
    predecessors[edge.target].push(edge.source);
    successors[edge.source].push(edge.target);
    incomingEdges[edge.target].push(edge);
    outgoingEdges[edge.source].push(edge);
  }

  return { predecessors, successors, incomingEdges, outgoingEdges };
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

function shouldSkipByConditionalBranch(
  nodeId: string,
  graph: {
    incomingEdges: Record<string, any[]>;
  },
  nodesById: Map<string, any>,
  nodeStates: Record<string, NodeState>,
  context: ExecutionContext
) {
  const incomingEdges = graph.incomingEdges[nodeId] || [];
  if (!incomingEdges.length) return false;

  let explicitlySelected = false;
  let explicitlyRejected = false;

  for (const edge of incomingEdges) {
    const sourceNode = nodesById.get(edge.source);
    if (!sourceNode || nodeType(sourceNode) !== "conditional_branch") continue;
    const sourceState = nodeStates[edge.source]?.status;
    if (sourceState !== "succeeded") continue;

    const decision = context.__branches?.[edge.source];
    if (!decision) continue;
    const selectedTarget = asNonEmptyString(decision.targetId);
    if (selectedTarget) {
      if (selectedTarget === edge.target) explicitlySelected = true;
      else explicitlyRejected = true;
      continue;
    }

    if (edge?.data && typeof edge.data === "object" && "when" in edge.data) {
      const edgeWhen = asBooleanOrNull((edge.data as Record<string, unknown>).when);
      if (edgeWhen === null) continue;
      if (edgeWhen === decision.result) explicitlySelected = true;
      else explicitlyRejected = true;
    }
  }

  return explicitlyRejected && !explicitlySelected;
}

function resolveConditionalOperand(nodeData: any, context: ExecutionContext) {
  if (nodeData?.inputKey) {
    return context[String(nodeData.inputKey)];
  }
  if (nodeData?.leftKey) {
    return context[String(nodeData.leftKey)];
  }
  return nodeData?.left;
}

function asNonEmptyString(value: unknown) {
  const text = String(value || "").trim();
  return text || "";
}

function asBooleanOrNull(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return null;
}

export function evaluateCondition(left: unknown, right: unknown, operator: string) {
  const op = operator.toLowerCase();
  if (op === "truthy") return Boolean(left);
  if (op === "falsy") return !left;
  if (op === "eq" || op === "equals") return left === right;
  if (op === "ne" || op === "not_equals") return left !== right;
  if (op === "gt") return Number(left) > Number(right);
  if (op === "gte") return Number(left) >= Number(right);
  if (op === "lt") return Number(left) < Number(right);
  if (op === "lte") return Number(left) <= Number(right);
  if (op === "contains") {
    if (Array.isArray(left)) return left.includes(right);
    return String(left ?? "").includes(String(right ?? ""));
  }
  if (op === "in") {
    if (!Array.isArray(right)) return false;
    return right.includes(left);
  }
  return Boolean(left);
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

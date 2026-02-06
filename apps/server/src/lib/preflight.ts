import type { PrismaClient } from "@prisma/client";
import { access } from "fs/promises";
import { resolvePlaywrightHeadless } from "./runner.js";

type ServiceState = "ok" | "warning" | "error";

export type PreflightResult = {
  ready: boolean;
  checks: {
    webAutomation: { state: ServiceState; message: string; headless: boolean };
    desktopAutomation: { state: ServiceState; message: string };
    ollama: { state: ServiceState; message: string };
  };
  messages: string[];
};

type PreflightDeps = {
  checkHealthFn?: (baseUrl: string, path: string) => Promise<boolean>;
  hasDisplayAccessFn?: () => Promise<boolean>;
  checkDesktopReadyFn?: (baseUrl: string) => Promise<{ ok: boolean; message: string }>;
};

export async function preflightForDefinition(definition: any, deps: PreflightDeps = {}): Promise<PreflightResult> {
  const needsWeb = workflowNeedsWeb(definition);
  const needsDesktop = workflowNeedsDesktop(definition);
  const headless = resolvePlaywrightHeadless({ data: {} }, definition?.execution);
  const checkHealthFn = deps.checkHealthFn || checkHealth;
  const hasDisplayAccessFn = deps.hasDisplayAccessFn || hasDisplayAccess;
  const checkDesktopReadyFn = deps.checkDesktopReadyFn || checkDesktopReady;

  const [desktopReady, ollamaHealth, displayAvailable] = await Promise.all([
    checkDesktopReadyFn(process.env.AGENT_BASE_URL || "http://agent:7001"),
    checkHealthFn(process.env.OLLAMA_BASE_URL || "http://ollama:11434", "/api/tags"),
    hasDisplayAccessFn()
  ]);

  const checks: PreflightResult["checks"] = {
    webAutomation: {
      state: "ok",
      message: needsWeb
        ? headless
          ? "Web automation will run in headless mode"
          : displayAvailable
            ? "Web automation will run with display"
            : "Display unavailable while Playwright headless mode is disabled"
        : "No web automation nodes in this workflow",
      headless
    },
    desktopAutomation: {
      state: "ok",
      message: needsDesktop
        ? desktopReady.ok
          ? "Desktop automation is ready"
          : desktopReady.message
        : "No desktop automation nodes in this workflow"
    },
    ollama: {
      state: ollamaHealth ? "ok" : "warning",
      message: ollamaHealth ? "Ollama reachable" : "Ollama unreachable (LLM nodes may fail)"
    }
  };

  if (needsWeb && !headless && !displayAvailable) {
    checks.webAutomation.state = "error";
  }

  if (needsDesktop && !desktopReady.ok) {
    checks.desktopAutomation.state = "error";
  }

  const messages: string[] = [];
  if (checks.webAutomation.state === "error") messages.push(checks.webAutomation.message);
  if (checks.desktopAutomation.state === "error") messages.push(checks.desktopAutomation.message);
  if (checks.ollama.state === "warning") messages.push(checks.ollama.message);

  const ready = checks.webAutomation.state !== "error" && checks.desktopAutomation.state !== "error";
  return { ready, checks, messages };
}

export async function preflightForWorkflowId(prisma: PrismaClient, workflowId: string) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) {
    throw new Error("Workflow not found");
  }
  const definition = workflow.draftDefinition ?? workflow.definition ?? workflow.publishedDefinition;
  return preflightForDefinition(definition);
}

export function workflowNeedsDesktop(definition: any): boolean {
  const nodes = definition?.nodes || [];
  return nodes.some((node: any) => String(node?.data?.type || node?.type || "").startsWith("desktop_"));
}

export function workflowNeedsWeb(definition: any): boolean {
  const nodes = definition?.nodes || [];
  return nodes.some((node: any) => String(node?.data?.type || node?.type || "").startsWith("playwright_"));
}

async function checkHealth(baseUrl: string, path: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}${path}`, 2500);
    return res.ok;
  } catch {
    return false;
  }
}

async function checkDesktopReady(baseUrl: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/preflight`, 2500);
    if (!res.ok) {
      return { ok: false, message: "Desktop agent preflight endpoint unavailable" };
    }
    const json = await res.json().catch(() => ({}));
    if (json?.ok) {
      return { ok: true, message: "Desktop automation is ready" };
    }
    const message = json?.error
      ? `Desktop preflight failed: ${json.error}`
      : "Desktop preflight failed";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Desktop agent is not reachable" };
  }
}

export async function hasDisplayAccess() {
  const display = process.env.DISPLAY || "";
  if (!display) return false;
  try {
    await access("/tmp/.X11-unix");
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

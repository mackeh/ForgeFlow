import { randomUUID } from "crypto";
import { chromium, type Browser, type Page } from "playwright";
import type { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";

export type RecorderSessionInfo = {
  sessionId: string;
  wsUrl: string;
};

type RecorderSession = {
  id: string;
  browser: Browser;
  page: Page;
  clients: Set<WebSocket>;
  events: Array<Record<string, unknown>>;
};

type RecorderDeps = {
  launchBrowser?: (options: { headless: boolean; args: string[] }) => Promise<Browser>;
  makeId?: () => string;
};

const sessions = new Map<string, RecorderSession>();
const sessionsByPage = new Map<Page, RecorderSession>();

export async function startWebRecorder(
  { startUrl }: { startUrl?: string },
  deps: RecorderDeps = {}
): Promise<RecorderSessionInfo> {
  const headlessRaw = String(process.env.PLAYWRIGHT_HEADLESS ?? "false").toLowerCase().trim();
  const headless = !(headlessRaw === "0" || headlessRaw === "false" || headlessRaw === "no");
  const launchBrowser = deps.launchBrowser ?? chromium.launch;
  const makeId = deps.makeId ?? randomUUID;

  const browser = await launchBrowser({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    const buildSelector = (el: Element | null): string => {
      if (!el) return "";
      if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current.nodeType === 1 && parts.length < 5) {
        const tag = current.tagName.toLowerCase();
        const className = (current as HTMLElement).className
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .join(".");
        const index = current.parentElement
          ? Array.from(current.parentElement.children).indexOf(current) + 1
          : 1;
        const selector = className ? `${tag}.${className}:nth-child(${index})` : `${tag}:nth-child(${index})`;
        parts.unshift(selector);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };

    const send = (payload: any) => {
      // @ts-expect-error injected binding
      window.rpaRecordEvent(payload);
    };

    document.addEventListener("click", (event) => {
      const target = event.target as Element;
      send({
        type: "click",
        selector: buildSelector(target),
        text: (target as HTMLElement)?.innerText?.slice(0, 120)
      });
    }, true);

    document.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      if (!target) return;
      send({
        type: "fill",
        selector: buildSelector(target),
        value: target.value
      });
    }, true);

    document.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      if (!target) return;
      send({
        type: "change",
        selector: buildSelector(target),
        value: target.value
      });
    }, true);
  });

  await page.exposeBinding("rpaRecordEvent", (_source, payload) => {
    const session = sessionsByPage.get(page);
    if (!session) return;
    session.events.push(payload);
    session.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "recorder:event", payload }));
      }
    });
  });

  if (startUrl) {
    await page.goto(startUrl);
  }

  const id = makeId();
  const session: RecorderSession = {
    id,
    browser,
    page,
    clients: new Set(),
    events: []
  };
  sessions.set(id, session);
  sessionsByPage.set(page, session);

  return { sessionId: id, wsUrl: `/ws?type=recorder&sessionId=${id}` };
}

export function attachRecorderWs(wss: WebSocketServer) {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const type = url.searchParams.get("type");
    const sessionId = url.searchParams.get("sessionId");

    if (type !== "recorder") {
      return;
    }

    if (!sessionId) {
      ws.close();
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      ws.close();
      return;
    }

    session.clients.add(ws);
    ws.send(JSON.stringify({ type: "recorder:ready", payload: { sessionId } }));

    ws.on("close", () => {
      session.clients.delete(ws);
    });
  });
}

export async function stopWebRecorder(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  await session.browser.close();
  sessions.delete(sessionId);
  sessionsByPage.delete(session.page);
  return { sessionId, events: session.events };
}

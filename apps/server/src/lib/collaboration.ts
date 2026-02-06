import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { URL } from "url";
import type { WebSocketServer, WebSocket } from "ws";
import { resolveAuthContextFromToken, type AuthContext } from "./auth.js";

export type WorkflowComment = {
  id: string;
  workflowId: string;
  nodeId?: string;
  message: string;
  authorUsername: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowPresence = {
  clientId: string;
  workflowId: string;
  username: string;
  role: string;
  status: "viewing" | "editing";
  currentNodeId?: string;
  joinedAt: string;
  lastSeenAt: string;
};

type CollaborationStore = {
  comments: WorkflowComment[];
};

type RoomClient = {
  ws: WebSocket;
  presence: WorkflowPresence;
};

const roomClients = new Map<string, Map<string, RoomClient>>();

function storePath() {
  return process.env.COLLAB_FILE || path.resolve(process.cwd(), "data", "collaboration.json");
}

async function ensureStoreFile() {
  const file = storePath();
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(file, "utf8");
  } catch {
    const initial: CollaborationStore = { comments: [] };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<CollaborationStore> {
  await ensureStoreFile();
  const file = storePath();
  const raw = await readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw) as CollaborationStore;
    if (!Array.isArray(parsed.comments)) return { comments: [] };
    return parsed;
  } catch {
    return { comments: [] };
  }
}

async function writeStore(store: CollaborationStore) {
  await ensureStoreFile();
  const file = storePath();
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function listWorkflowComments(workflowId: string) {
  const store = await readStore();
  return store.comments
    .filter((comment) => comment.workflowId === workflowId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export async function createWorkflowComment(args: {
  workflowId: string;
  nodeId?: string;
  message: string;
  author: AuthContext;
}) {
  const message = args.message.trim();
  if (!message) {
    throw new Error("Comment message is required");
  }
  const now = new Date().toISOString();
  const comment: WorkflowComment = {
    id: randomUUID(),
    workflowId: args.workflowId,
    nodeId: args.nodeId?.trim() || undefined,
    message,
    authorUsername: args.author.username,
    authorRole: args.author.role,
    createdAt: now,
    updatedAt: now
  };
  const store = await readStore();
  store.comments.push(comment);
  await writeStore(store);
  return comment;
}

export async function deleteWorkflowComment(args: {
  workflowId: string;
  commentId: string;
  actor: AuthContext;
}) {
  const store = await readStore();
  const idx = store.comments.findIndex(
    (comment) => comment.id === args.commentId && comment.workflowId === args.workflowId
  );
  if (idx < 0) return false;
  const comment = store.comments[idx];
  const isAdmin = args.actor.permissions.includes("*");
  if (!isAdmin && comment.authorUsername !== args.actor.username) {
    throw new Error("Only comment author or admin can delete");
  }
  store.comments.splice(idx, 1);
  await writeStore(store);
  return true;
}

export function listWorkflowPresence(workflowId: string): WorkflowPresence[] {
  const room = roomClients.get(workflowId);
  if (!room) return [];
  return Array.from(room.values())
    .map((entry) => ({ ...entry.presence }))
    .sort((a, b) => {
      if (a.username === b.username) return a.joinedAt.localeCompare(b.joinedAt);
      return a.username.localeCompare(b.username);
    });
}

function safeSend(ws: WebSocket, payload: unknown) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify(payload));
}

function broadcastPresence(workflowId: string) {
  const room = roomClients.get(workflowId);
  if (!room) return;
  const presence = listWorkflowPresence(workflowId);
  room.forEach((entry) => {
    safeSend(entry.ws, {
      type: "collab:presence",
      payload: { workflowId, presence, at: new Date().toISOString() }
    });
  });
}

function updatePresence(room: Map<string, RoomClient>, clientId: string, patch: Partial<WorkflowPresence>) {
  const client = room.get(clientId);
  if (!client) return;
  client.presence = {
    ...client.presence,
    ...patch,
    lastSeenAt: new Date().toISOString()
  };
  room.set(clientId, client);
}

export function attachCollaborationWs(wss: WebSocketServer) {
  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const type = url.searchParams.get("type");
    if (type !== "collab") return;

    const workflowId = String(url.searchParams.get("workflowId") || "").trim();
    const token = String(url.searchParams.get("token") || "").trim();
    if (!workflowId || !token) {
      ws.close();
      return;
    }

    let auth: AuthContext | null = null;
    try {
      auth = await resolveAuthContextFromToken(token);
    } catch {
      auth = null;
    }
    if (!auth) {
      ws.close();
      return;
    }

    const clientId = randomUUID();
    const now = new Date().toISOString();
    const room = roomClients.get(workflowId) || new Map<string, RoomClient>();
    room.set(clientId, {
      ws,
      presence: {
        clientId,
        workflowId,
        username: auth.username,
        role: auth.role,
        status: "viewing",
        joinedAt: now,
        lastSeenAt: now
      }
    });
    roomClients.set(workflowId, room);

    safeSend(ws, {
      type: "collab:ready",
      payload: {
        workflowId,
        clientId,
        user: { username: auth.username, role: auth.role },
        presence: listWorkflowPresence(workflowId)
      }
    });
    broadcastPresence(workflowId);

    ws.on("message", (raw) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(String(raw || "{}"));
      } catch {
        return;
      }
      const messageType = String(parsed?.type || "").trim();
      if (messageType === "collab:ping") {
        updatePresence(room, clientId, {});
        safeSend(ws, { type: "collab:pong", payload: { workflowId, at: new Date().toISOString() } });
        return;
      }
      if (messageType === "collab:state") {
        const statusRaw = String(parsed?.payload?.status || "viewing").toLowerCase();
        const status: "viewing" | "editing" = statusRaw === "editing" ? "editing" : "viewing";
        const currentNodeId = String(parsed?.payload?.currentNodeId || "").trim() || undefined;
        updatePresence(room, clientId, { status, currentNodeId });
        broadcastPresence(workflowId);
      }
    });

    ws.on("close", () => {
      room.delete(clientId);
      if (room.size === 0) {
        roomClients.delete(workflowId);
      } else {
        roomClients.set(workflowId, room);
      }
      broadcastPresence(workflowId);
    });
  });
}

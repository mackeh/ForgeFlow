import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState
} from "reactflow";
import "reactflow/dist/style.css";
import {
  API_URL,
  approveRun,
  beginTwoFactorSetup,
  clearToken,
  createAdminUser,
  createIntegration,
  createWorkflowComment,
  createWebhook,
  createWorkflow,
  createWorkflowFromTemplate,
  createSchedule,
  deleteAdminUser,
  deleteIntegration,
  deleteSchedule,
  deleteWebhook,
  deleteWorkflowComment,
  getDashboardMetrics,
  getIntegrations,
  getAdminUsers,
  getAuditEvents,
  getCurrentUser,
  getTwoFactorStatus,
  deleteWorkflow,
  getRoles,
  getRun,
  getRunDiff,
  getWorkflow,
  getSchedulePresets,
  getSchedules,
  getUpcomingSchedules,
  getSecrets,
  getSystemTime,
  getTemplates,
  getWebhookEvents,
  getWebhooks,
  getWorkflowComments,
  getWorkflowHistory,
  getWorkflowPresence,
  getWorkflowRuns,
  getWorkflowVersions,
  getWorkflows,
  importCsv,
  login,
  publishWorkflow,
  rollbackWorkflow,
  runScheduleNow,
  runPreflight,
  saveSecret,
  previewSchedule as fetchSchedulePreview,
  startDesktopRecorder,
  startRecorder,
  startRun,
  stopDesktopRecorder,
  testIntegration,
  testWebhook,
  updateAdminUser,
  updateRole,
  updateWebhook,
  updateSchedule,
  updateWorkflow,
  verifyTwoFactorSetup,
} from "./api";
import { ActionNode } from "./components/ActionNode";
import { Sidebar } from "./components/Sidebar";
import { Inspector } from "./components/Inspector";
import type { WorkflowDefinition, WorkflowRecord, WorkflowRunDetail, WorkflowRunSummary, WorkflowSummary, WorkflowVersion } from "./types";

const nodeTypes = { action: ActionNode };
type ToastLevel = "info" | "success" | "error";
type ToastAction = {
  label: string;
  onClick: () => void;
};
type Toast = { id: number; message: string; level: ToastLevel; action?: ToastAction };
type UiLogEntry = {
  id: number;
  at: string;
  level: ToastLevel;
  message: string;
};
type SchedulePreset = {
  id: string;
  name: string;
  description: string;
  cron: string;
};
type SchedulePreview = {
  nextRunAtUtc: string | null;
  nextRunAtLocal: string | null;
  timezone: string;
  cron: string;
};
type AuditEvent = {
  id: string;
  at: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  message?: string;
};
type UpcomingScheduleItem = {
  scheduleId: string;
  scheduleName: string;
  workflowId: string;
  cron: string;
  timezone: string;
  atUtc: string;
  atLocal: string;
};
type RunArtifact = {
  nodeId?: string;
  type?: string;
  path?: string;
  attempt?: number;
  createdAt?: string;
  error?: string;
};

type WorkflowPresence = {
  clientId: string;
  workflowId: string;
  username: string;
  role: string;
  status: "viewing" | "editing";
  currentNodeId?: string;
  joinedAt: string;
  lastSeenAt: string;
};

type WorkflowComment = {
  id: string;
  workflowId: string;
  nodeId?: string;
  message: string;
  authorUsername: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};

type WorkflowHistory = {
  workflowId: string;
  versions: Array<{ id: string; version: number; status: string; notes?: string; createdAt: string }>;
  events: Array<{
    id: string;
    at: string;
    actorUsername: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    success: boolean;
    message?: string;
  }>;
};

type IntegrationItem = {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type TwoFactorStatus = {
  enabled: boolean;
  pending: boolean;
};

type TwoFactorSetupPayload = {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
};

const defaultDefinition: WorkflowDefinition = {
  nodes: [
    {
      id: "start",
      type: "action",
      position: { x: 80, y: 80 },
      data: { label: "Start", type: "start" }
    }
  ],
  edges: [],
  execution: {
    globalTimeoutMs: 1800000,
    defaultRetries: 2,
    defaultNodeTimeoutMs: 30000
  }
};

function artifactPathToUrl(apiUrl: string, artifactPath?: string) {
  if (!artifactPath) return null;
  const normalized = artifactPath.replace(/\\/g, "/");
  if (normalized.includes("/app/artifacts/")) {
    const rel = normalized.split("/app/artifacts/")[1];
    return `${apiUrl}/artifacts/${encodeURI(rel)}`;
  }
  if (normalized.includes("/artifacts/")) {
    const rel = normalized.split("/artifacts/")[1];
    return `${apiUrl}/artifacts/${encodeURI(rel)}`;
  }
  return null;
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loginTotpCode, setLoginTotpCode] = useState("");
  const [workflowList, setWorkflowList] = useState<WorkflowSummary[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowRecord | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultDefinition.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultDefinition.edges as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [status, setStatus] = useState<string>("");
  const [desktopRecording, setDesktopRecording] = useState(false);
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [activeRun, setActiveRun] = useState<WorkflowRunDetail | null>(null);
  const [runDiff, setRunDiff] = useState<any | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [rollbackVersion, setRollbackVersion] = useState<number | "">("");
  const [secrets, setSecrets] = useState<any[]>([]);
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateWorkflowName, setTemplateWorkflowName] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("all");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [integrationName, setIntegrationName] = useState("Primary API");
  const [integrationType, setIntegrationType] = useState("http_api");
  const [integrationConfigText, setIntegrationConfigText] = useState("{\"baseUrl\":\"https://example.com\"}");
  const [csvImportText, setCsvImportText] = useState("name,email\nAlice,alice@example.com");
  const [csvImportPath, setCsvImportPath] = useState("");
  const [scheduleName, setScheduleName] = useState("Daily Run");
  const [scheduleCron, setScheduleCron] = useState("0 9 * * *");
  const [scheduleTimezone, setScheduleTimezone] = useState("");
  const [scheduleTestMode, setScheduleTestMode] = useState(false);
  const [scheduleDependsOnId, setScheduleDependsOnId] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceStart, setMaintenanceStart] = useState("22:00");
  const [maintenanceEnd, setMaintenanceEnd] = useState("23:59");
  const [maintenanceWeekdays, setMaintenanceWeekdays] = useState("1,2,3,4,5");
  const [schedulePresets, setSchedulePresets] = useState<SchedulePreset[]>([]);
  const [selectedSchedulePreset, setSelectedSchedulePreset] = useState("");
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreview | null>(null);
  const [upcomingSchedules, setUpcomingSchedules] = useState<UpcomingScheduleItem[]>([]);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [dashboardDays, setDashboardDays] = useState(7);
  const [systemTime, setSystemTime] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("operator");
  const [webhookList, setWebhookList] = useState<any[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookName, setWebhookName] = useState("Run Alerts");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEventSelection, setWebhookEventSelection] = useState<string[]>(["run.failed"]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uiLogs, setUiLogs] = useState<UiLogEntry[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [collabPresence, setCollabPresence] = useState<WorkflowPresence[]>([]);
  const [workflowComments, setWorkflowComments] = useState<WorkflowComment[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistory | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupPayload | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");

  const nodesRef = useRef<Node[]>(nodes);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(1);
  const logIdRef = useRef(1);
  const collabSocketRef = useRef<WebSocket | null>(null);
  const collabHeartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const nodeOptions = useMemo(
    () => [
      { label: "HTTP Request", type: "http_request" },
      { label: "Set Variable", type: "set_variable" },
      { label: "LLM Clean", type: "transform_llm" },
      { label: "Validate Record", type: "validate_record" },
      { label: "Submit Guard", type: "submit_guard" },
      { label: "Manual Approval", type: "manual_approval" },
      { label: "Conditional Branch", type: "conditional_branch" },
      { label: "Loop Iterate", type: "loop_iterate" },
      { label: "Parallel Execute", type: "parallel_execute" },
      { label: "CSV Import", type: "data_import_csv" },
      { label: "Integration Request", type: "integration_request" },
      { label: "Web Navigate", type: "playwright_navigate" },
      { label: "Web Click", type: "playwright_click" },
      { label: "Web Fill", type: "playwright_fill" },
      { label: "Web Extract", type: "playwright_extract" },
      { label: "Web Visual Assert", type: "playwright_visual_assert" },
      { label: "Desktop Click", type: "desktop_click" },
      { label: "Desktop Click Image", type: "desktop_click_image" },
      { label: "Desktop Type", type: "desktop_type" },
      { label: "Desktop Wait Image", type: "desktop_wait_for_image" }
    ],
    []
  );

  const templateCategories = useMemo(() => {
    const categories = Array.from(new Set((templates || []).map((template) => String(template.category || "other"))));
    return ["all", ...categories.sort((a, b) => a.localeCompare(b))];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();
    return (templates || []).filter((template) => {
      const matchesCategory = templateCategoryFilter === "all" || template.category === templateCategoryFilter;
      if (!matchesCategory) return false;
      if (!search) return true;
      const text = [
        template.name,
        template.description,
        template.useCase,
        ...(Array.isArray(template.tags) ? template.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(search);
    });
  }, [templates, templateSearch, templateCategoryFilter]);

  const selectedTemplate = useMemo(
    () => (templates || []).find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const activeSchedulePreset = useMemo(
    () => schedulePresets.find((preset) => preset.id === selectedSchedulePreset) || null,
    [schedulePresets, selectedSchedulePreset]
  );

  const runArtifacts = useMemo(
    () => (Array.isArray(activeRun?.artifacts) ? (activeRun.artifacts as RunArtifact[]) : []),
    [activeRun?.id, activeRun?.artifacts]
  );

  const screenshotArtifacts = useMemo(
    () => runArtifacts.filter((artifact) => String(artifact.type || "") === "screenshot"),
    [runArtifacts]
  );

  const domArtifacts = useMemo(
    () => runArtifacts.filter((artifact) => String(artifact.type || "") === "dom_snapshot"),
    [runArtifacts]
  );

  const visualArtifacts = useMemo(
    () => runArtifacts.filter((artifact) => String(artifact.type || "").startsWith("visual_")),
    [runArtifacts]
  );

  const failedNodes = useMemo(() => {
    if (!activeRun?.nodeStates || typeof activeRun.nodeStates !== "object" || Array.isArray(activeRun.nodeStates)) {
      return [] as Array<{ nodeId: string; error?: string; attempts?: number; durationMs?: number }>;
    }
    return Object.entries(activeRun.nodeStates as Record<string, any>)
      .filter(([, state]) => state && typeof state === "object" && String(state.status || "") === "failed")
      .map(([nodeId, state]) => ({
        nodeId,
        error: state.error ? String(state.error) : "",
        attempts: typeof state.attempts === "number" ? state.attempts : undefined,
        durationMs: typeof state.durationMs === "number" ? state.durationMs : undefined
      }))
      .slice(0, 8);
  }, [activeRun?.id, activeRun?.nodeStates]);

  const runErrorLogs = useMemo(() => {
    const logs = Array.isArray(activeRun?.logs) ? activeRun.logs : [];
    return [...logs]
      .reverse()
      .filter((entry: any) => {
        const status = String(entry?.status || "");
        return status === "failed" || status === "retry_error" || status === "waiting_approval";
      })
      .slice(0, 8);
  }, [activeRun?.id, activeRun?.logs]);

  const runNetworkLogs = useMemo(() => {
    const logs = Array.isArray(activeRun?.context?.__networkLogs) ? activeRun.context.__networkLogs : [];
    return [...logs].reverse().slice(0, 12);
  }, [activeRun?.id, activeRun?.context]);

  const runContextEntries = useMemo(() => {
    const ctx = activeRun?.context;
    if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return [];
    return Object.entries(ctx as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("__"))
      .map(([key, value]) => {
        const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
        const preview =
          type === "string"
            ? String(value).slice(0, 120)
            : JSON.stringify(value)?.slice(0, 160) || String(value);
        return { key, type, preview };
      })
      .slice(0, 30);
  }, [activeRun?.id, activeRun?.context]);

  const runProgress = useMemo(() => {
    if (!activeRun?.nodeStates || typeof activeRun.nodeStates !== "object" || Array.isArray(activeRun.nodeStates)) {
      return null;
    }
    const values = Object.values(activeRun.nodeStates as Record<string, any>);
    if (!values.length) return null;
    const completed = values.filter((state: any) => {
      const status = String(state?.status || "");
      return status === "succeeded" || status === "failed" || status === "skipped";
    }).length;
    const running = values.filter((state: any) => String(state?.status || "") === "running").length;
    const queued = values.filter((state: any) => String(state?.status || "") === "queued").length;
    const pct = Math.max(0, Math.min(100, Math.round((completed / values.length) * 100)));
    return {
      total: values.length,
      completed,
      running,
      queued,
      pct
    };
  }, [activeRun?.id, activeRun?.nodeStates]);

  const dailyTrend = useMemo(() => {
    const points = Array.isArray(dashboard?.daily) ? dashboard.daily : [];
    const maxTotal = points.reduce((max: number, point: any) => Math.max(max, Number(point?.total || 0)), 0);
    return points.slice(-10).map((point: any) => {
      const total = Number(point?.total || 0);
      const succeeded = Number(point?.succeeded || 0);
      const failed = Number(point?.failed || 0);
      const successPct = total ? Math.round((succeeded / total) * 100) : 0;
      const barPct = maxTotal ? Math.max(6, Math.round((total / maxTotal) * 100)) : 6;
      return {
        date: String(point?.date || "-"),
        total,
        succeeded,
        failed,
        successPct,
        barPct
      };
    });
  }, [dashboard?.daily]);

  const hourlyTrend = useMemo(() => {
    const points = Array.isArray(dashboard?.hourly) ? dashboard.hourly : [];
    const maxTotal = points.reduce((max: number, point: any) => Math.max(max, Number(point?.total || 0)), 0);
    return points.map((point: any) => {
      const total = Number(point?.total || 0);
      const barPct = maxTotal ? Math.max(6, Math.round((total / maxTotal) * 100)) : 6;
      return {
        hour: String(point?.hour || "--"),
        total,
        barPct
      };
    });
  }, [dashboard?.hourly]);

  const upcomingScheduleGroups = useMemo(() => {
    const groups = new Map<string, UpcomingScheduleItem[]>();
    for (const item of upcomingSchedules) {
      const localKey = String(item.atLocal || "").split(" ")[0] || "Unknown date";
      const list = groups.get(localKey) || [];
      list.push(item);
      groups.set(localKey, list);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((x, y) => x.atLocal.localeCompare(y.atLocal))
      }));
  }, [upcomingSchedules]);

  useEffect(() => {
    if (!token) return;
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
      })
      .catch(showError);
    getTwoFactorStatus()
      .then((status) => {
        setTwoFactorStatus(status as TwoFactorStatus);
      })
      .catch(showError);
    refreshWorkflows().catch(showError);
    getSecrets()
      .then(setSecrets)
      .catch(showError);
    getTemplates()
      .then((list) => {
        setTemplates(list || []);
        if (Array.isArray(list) && list.length && !selectedTemplateId) {
          setSelectedTemplateId(list[0].id);
        }
      })
      .catch(showError);
    getIntegrations()
      .then((list) => {
        setIntegrations(Array.isArray(list) ? (list as IntegrationItem[]) : []);
      })
      .catch(showError);
    getSchedulePresets()
      .then((list) => {
        const presets = Array.isArray(list) ? (list as SchedulePreset[]) : [];
        setSchedulePresets(presets);
        if (!selectedSchedulePreset && presets.length) {
          setSelectedSchedulePreset(presets[0].id);
        }
      })
      .catch(showError);
    getSystemTime()
      .then((value) => {
        setSystemTime(value);
        if (!scheduleTimezone) {
          setScheduleTimezone(value.timezone);
        }
      })
      .catch(showError);
    refreshAdmin().catch((error) => {
      const message = error instanceof Error ? error.message : String(error || "");
      if (!message.includes("Missing permission")) {
        showError(error);
      }
    });
    refreshDashboard().catch(showError);
  }, [token]);

  useEffect(() => {
    if (!token || !activeWorkflow?.id) return;
    refreshSchedules(activeWorkflow.id).catch(showError);
  }, [token, activeWorkflow?.id]);

  useEffect(() => {
    const existing = collabSocketRef.current;
    if (existing) {
      existing.close();
      collabSocketRef.current = null;
    }
    if (collabHeartbeatRef.current !== null) {
      window.clearInterval(collabHeartbeatRef.current);
      collabHeartbeatRef.current = null;
    }
    if (!token || !activeWorkflow?.id) return;

    const wsBase = API_URL.replace(/^http/i, "ws");
    const wsUrl = `${wsBase}/ws?type=collab&workflowId=${encodeURIComponent(
      activeWorkflow.id
    )}&token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    collabSocketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "collab:state",
          payload: {
            status: selectedNode ? "editing" : "viewing",
            currentNodeId: selectedNode?.id || undefined
          }
        })
      );
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data || "{}"));
        if (message?.type === "collab:presence") {
          setCollabPresence(Array.isArray(message?.payload?.presence) ? message.payload.presence : []);
          return;
        }
        if (message?.type === "collab:ready") {
          setCollabPresence(Array.isArray(message?.payload?.presence) ? message.payload.presence : []);
        }
      } catch {
        // ignore malformed ws payloads
      }
    };

    collabHeartbeatRef.current = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "collab:ping" }));
      }
    }, 10_000);

    return () => {
      if (collabHeartbeatRef.current !== null) {
        window.clearInterval(collabHeartbeatRef.current);
        collabHeartbeatRef.current = null;
      }
      socket.close();
      if (collabSocketRef.current === socket) {
        collabSocketRef.current = null;
      }
    };
  }, [token, activeWorkflow?.id]);

  useEffect(() => {
    const socket = collabSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "collab:state",
        payload: {
          status: selectedNode ? "editing" : "viewing",
          currentNodeId: selectedNode?.id || undefined
        }
      })
    );
  }, [selectedNode?.id]);

  useEffect(() => {
    setWorkflowName(activeWorkflow?.name || "");
    setScheduleDependsOnId("");
  }, [activeWorkflow?.id, activeWorkflow?.name]);

  useEffect(() => {
    if (!activeRun?.id) return;
    if (!["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(activeRun.status)) return;

    const timer = setInterval(() => {
      loadRun(activeRun.id).catch(() => undefined);
    }, 900);

    return () => clearInterval(timer);
  }, [activeRun?.id, activeRun?.status]);

  useEffect(() => {
    const rawNodeStates =
      activeRun?.nodeStates && typeof activeRun.nodeStates === "object" && !Array.isArray(activeRun.nodeStates)
        ? (activeRun.nodeStates as Record<string, any>)
        : null;

    setNodes((current) =>
      current.map((node) => {
        const prevData = (node.data || {}) as Record<string, any>;
        const state = rawNodeStates?.[node.id];
        const nextData: Record<string, any> = { ...prevData };

        if (state && typeof state === "object") {
          nextData.__runStatus = String(state.status || "");
          nextData.__runDurationMs = typeof state.durationMs === "number" ? state.durationMs : undefined;
          nextData.__runStartedAt = state.startedAt ? String(state.startedAt) : "";
          nextData.__runAttempts = typeof state.attempts === "number" ? state.attempts : undefined;
          nextData.__runError = state.error ? String(state.error) : "";
        } else {
          delete nextData.__runStatus;
          delete nextData.__runDurationMs;
          delete nextData.__runStartedAt;
          delete nextData.__runAttempts;
          delete nextData.__runError;
        }

        const unchanged =
          prevData.__runStatus === nextData.__runStatus &&
          prevData.__runDurationMs === nextData.__runDurationMs &&
          prevData.__runStartedAt === nextData.__runStartedAt &&
          prevData.__runAttempts === nextData.__runAttempts &&
          prevData.__runError === nextData.__runError;
        return unchanged ? node : { ...node, data: nextData };
      })
    );
  }, [activeRun?.id, activeRun?.status, activeRun?.nodeStates]);

  useEffect(() => {
    if (!token) return;
    refreshDashboard(dashboardDays).catch(showError);
  }, [dashboardDays, systemTime?.timezone, token]);

  useEffect(() => {
    if (!token) {
      setSchedulePreview(null);
      return;
    }
    const cron = scheduleCron.trim();
    if (!cron) {
      setSchedulePreview(null);
      return;
    }
    const timezone = (scheduleTimezone || systemTime?.timezone || "").trim();
    if (!timezone) return;

    const timer = window.setTimeout(() => {
      fetchSchedulePreview(cron, timezone)
        .then((preview) => {
          setSchedulePreview(preview || null);
        })
        .catch(() => {
          setSchedulePreview({
            cron,
            timezone,
            nextRunAtUtc: null,
            nextRunAtLocal: null
          });
        });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [token, scheduleCron, scheduleTimezone, systemTime?.timezone]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tagName = element.tagName?.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        Boolean(element.isContentEditable)
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!token) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const hasCmd = event.ctrlKey || event.metaKey;

      if (hasCmd && key === "s") {
        event.preventDefault();
        void withActionLoading("save-draft", handleSave);
        return;
      }
      if (hasCmd && key === "r") {
        event.preventDefault();
        void withActionLoading("run", () => runWorkflow(false));
        return;
      }
      if (hasCmd && key === "t") {
        event.preventDefault();
        void withActionLoading("test-run", () => runWorkflow(true));
        return;
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        handleDeleteSelectedNode();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        void withActionLoading("auto-layout", autoLayoutNodes);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [token, selectedNode, activeWorkflow, nodes, edges]);

  const pushToast = (message: string, level: ToastLevel = "info", action?: ToastAction) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, level, action }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const pushUiLog = (message: string, level: ToastLevel = "info") => {
    const id = logIdRef.current++;
    const entry: UiLogEntry = {
      id,
      at: new Date().toLocaleTimeString(),
      level,
      message
    };
    setUiLogs((prev) => [entry, ...prev].slice(0, 120));
  };

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.error ? String(event.error) : event.message || "Unknown window error";
      pushUiLog(message, "error");
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      pushUiLog(`Unhandled rejection: ${String(event.reason)}`, "error");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  const setFeedback = (message: string, level: ToastLevel = "info", action?: ToastAction) => {
    setStatus(message);
    pushUiLog(message, level);
    pushToast(message, level, action);
  };

  const showError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    if (
      message.includes("Missing token") ||
      message.includes("Invalid token") ||
      message.includes("Invalid token payload")
    ) {
      clearToken();
      setToken(null);
    }
    console.error("[ui]", error);
    setFeedback(message, "error");
  };

  const withActionLoading = async (actionId: string, run: () => Promise<void> | void) => {
    if (loadingActions[actionId]) return;
    setLoadingActions((prev) => ({ ...prev, [actionId]: true }));
    try {
      await run();
    } catch (error) {
      showError(error);
    } finally {
      setLoadingActions((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const isActionLoading = (actionId: string) => Boolean(loadingActions[actionId]);

  async function refreshWorkflows(forceSelectFirst = false) {
    const data = await getWorkflows();
    setWorkflowList(data);
    if ((forceSelectFirst || !activeWorkflow) && data.length) {
      await selectWorkflow(data[0]);
    }
  }

  async function refreshSchedules(workflowId?: string) {
    if (!workflowId) {
      setSchedules([]);
      setUpcomingSchedules([]);
      return;
    }
    const list = await getSchedules(workflowId);
    setSchedules(list || []);
    const upcoming = await getUpcomingSchedules({
      workflowId,
      days: 14,
      limit: 80,
      perSchedule: 6
    });
    setUpcomingSchedules(Array.isArray(upcoming?.items) ? upcoming.items : []);
  }

  async function refreshDashboard(days = dashboardDays) {
    const value = await getDashboardMetrics(days, systemTime?.timezone);
    setDashboard(value);
  }

  async function refreshAdmin() {
    const [userList, roleList, hooks, events, audit] = await Promise.all([
      getAdminUsers(),
      getRoles(),
      getWebhooks(),
      getWebhookEvents(),
      getAuditEvents({ limit: 40 }).catch(() => [])
    ]);
    setAdminUsers(userList || []);
    setRoles(roleList || []);
    setWebhookList(hooks || []);
    setWebhookEvents(events || []);
    setAuditEvents(Array.isArray(audit) ? audit : []);
    if (Array.isArray(events) && events.length && webhookEventSelection.length === 0) {
      setWebhookEventSelection([events[0]]);
    }
  }

  const refreshWorkflowMeta = async (workflowId: string) => {
    const [runList, versionList] = await Promise.all([
      getWorkflowRuns(workflowId),
      getWorkflowVersions(workflowId)
    ]);
    setRuns(runList);
    setVersions(versionList);
    if (versionList.length && rollbackVersion === "") {
      setRollbackVersion(versionList[0].version);
    }
    if (runList.length) {
      await loadRun(runList[0].id);
    } else {
      setActiveRun(null);
      setRunDiff(null);
    }
  };

  const refreshWorkflowCollaboration = async (workflowId: string) => {
    const [presenceResult, commentsResult, historyResult] = await Promise.all([
      getWorkflowPresence(workflowId).catch(() => ({ workflowId, presence: [] })),
      getWorkflowComments(workflowId).catch(() => []),
      getWorkflowHistory(workflowId, 80).catch(() => ({ workflowId, versions: [], events: [] }))
    ]);
    setCollabPresence(Array.isArray(presenceResult?.presence) ? presenceResult.presence : []);
    setWorkflowComments(Array.isArray(commentsResult) ? commentsResult : []);
    setWorkflowHistory(historyResult as WorkflowHistory);
  };

  const selectWorkflow = async (workflow: WorkflowSummary | WorkflowRecord) => {
    const fullWorkflow =
      "definition" in workflow || "draftDefinition" in workflow ? (workflow as WorkflowRecord) : await getWorkflow(workflow.id);
    setActiveWorkflow(fullWorkflow);
    const def = fullWorkflow.draftDefinition || fullWorkflow.definition || defaultDefinition;
    setNodes(def.nodes || defaultDefinition.nodes);
    setEdges(def.edges || []);
    await Promise.all([refreshWorkflowMeta(fullWorkflow.id), refreshWorkflowCollaboration(fullWorkflow.id)]);
  };

  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  };

  const handleLogin = async (username: string, password: string, totpCode?: string) => {
    try {
      const result = await login(username, password, totpCode);
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        throw new Error("Login failed: token was not stored");
      }
      const me = await getCurrentUser();
      setCurrentUser(me || result?.user || null);
      setToken(storedToken);
      setFeedback("Signed in", "success");
      setLoginTotpCode("");
    } catch (err: any) {
      if (err?.status === 428) {
        setFeedback("Two-factor code required for this account", "info");
        return;
      }
      showError(err);
    }
  };

  const handleCreateWorkflow = async () => {
    const name = `Workflow ${workflowList.length + 1}`;
    const created = await createWorkflow({ name, definition: defaultDefinition });
    setWorkflowList((list) => [created, ...list]);
    await selectWorkflow(created);
    setFeedback("Workflow created", "success");
    await refreshDashboard();
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) {
      setFeedback("Select a template first", "error");
      return;
    }
    const created = await createWorkflowFromTemplate({
      templateId: selectedTemplateId,
      name: templateWorkflowName.trim() || undefined
    });
    setTemplateWorkflowName("");
    setWorkflowList((list) => [created, ...list]);
    await selectWorkflow(created);
    setFeedback("Workflow created from template", "success");
    await refreshDashboard();
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
    setActiveWorkflow(null);
    setWorkflowList([]);
    setRuns([]);
    setIntegrations([]);
    setActiveRun(null);
    setRunDiff(null);
    setVersions([]);
    setSecrets([]);
    setTemplates([]);
    setSchedules([]);
    setScheduleDependsOnId("");
    setMaintenanceEnabled(false);
    setMaintenanceStart("22:00");
    setMaintenanceEnd("23:59");
    setMaintenanceWeekdays("1,2,3,4,5");
    setSchedulePresets([]);
    setSelectedSchedulePreset("");
    setSchedulePreview(null);
    setUpcomingSchedules([]);
    setDashboard(null);
    setSystemTime(null);
    setCurrentUser(null);
    setAdminUsers([]);
    setRoles([]);
    setAuditEvents([]);
    setWebhookList([]);
    setWebhookEvents([]);
    setCollabPresence([]);
    setWorkflowComments([]);
    setWorkflowHistory(null);
    setCommentDraft("");
    setTwoFactorStatus(null);
    setTwoFactorSetup(null);
    setTwoFactorToken("");
    setLoginTotpCode("");
    setNodes(defaultDefinition.nodes as Node[]);
    setEdges(defaultDefinition.edges as Edge[]);
    setStatus("");
  };

  const handleSave = async () => {
    if (!activeWorkflow) return null;
    const definition = buildCurrentDefinition();
    const updated = await updateWorkflow(activeWorkflow.id, { definition, notes: "Saved from UI" });
    setActiveWorkflow(updated);
    setWorkflowList((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    setFeedback("Draft saved", "success");
    return updated;
  };

  const runWorkflow = async (testMode = false, resumeFromRunId?: string) => {
    if (!activeWorkflow) return;
    const definition = buildCurrentDefinition();
    const validationErrors = validateWorkflowDefinition(definition);
    if (validationErrors.length) {
      const message = `Validation failed: ${validationErrors[0]}`;
      setFeedback(message, "error");
      return;
    }
    await handleSave();
    const preflight = await runPreflight({ definition });
    if (!preflight.ready) {
      const msg = preflight.messages?.join(" | ") || "Preflight failed";
      setFeedback(`Preflight blocked run: ${msg}`, "error");
      return;
    }
    const run = await startRun(activeWorkflow.id, { testMode, resumeFromRunId });
    setFeedback(testMode ? "Test run started" : "Run started", "success", {
      label: "View Run",
      onClick: () => {
        void loadRun(run.id).catch(showError);
      }
    });
    await refreshWorkflowMeta(activeWorkflow.id);
    await loadRun(run.id);
    await refreshDashboard();
  };

  const handlePublish = async () => {
    if (!activeWorkflow) return;
    await handleSave();
    await publishWorkflow(activeWorkflow.id, "Published from UI");
    setFeedback("Published", "success");
    await refreshWorkflowMeta(activeWorkflow.id);
    await refreshWorkflows();
  };

  const handleRollback = async () => {
    if (!activeWorkflow || rollbackVersion === "") return;
    await rollbackWorkflow(activeWorkflow.id, Number(rollbackVersion));
    setFeedback(`Rolled back to version ${rollbackVersion}`, "success");
    await refreshWorkflows();
    const latest = await getWorkflows();
    const wf = latest.find((x) => x.id === activeWorkflow.id);
    if (wf) await selectWorkflow(wf);
  };

  const findNextNodePosition = (existingNodes: Node[]) => {
    const baseX = 80;
    const baseY = 80;
    const gapX = 250;
    const gapY = 140;
    const maxCols = 4;
    const occupied = new Set(
      existingNodes.map((node) => {
        const col = Math.max(0, Math.round((node.position.x - baseX) / gapX));
        const row = Math.max(0, Math.round((node.position.y - baseY) / gapY));
        return `${col}:${row}`;
      })
    );
    for (let i = 0; i < 500; i += 1) {
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      const key = `${col}:${row}`;
      if (!occupied.has(key)) {
        return { x: baseX + col * gapX, y: baseY + row * gapY };
      }
    }
    return { x: baseX, y: baseY };
  };

  const autoLayoutNodes = () => {
    const baseX = 80;
    const baseY = 80;
    const gapX = 250;
    const gapY = 140;
    const maxCols = 4;
    const sorted = [...nodesRef.current].sort((a, b) => {
      const aStart = String(a.data?.type || "") === "start" ? 0 : 1;
      const bStart = String(b.data?.type || "") === "start" ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      return a.id.localeCompare(b.id);
    });

    const relayoutMap = new Map<string, { x: number; y: number }>();
    sorted.forEach((node, idx) => {
      const col = idx % maxCols;
      const row = Math.floor(idx / maxCols);
      relayoutMap.set(node.id, { x: baseX + col * gapX, y: baseY + row * gapY });
    });

    setNodes((current) =>
      current.map((node) => {
        const position = relayoutMap.get(node.id);
        return position ? { ...node, position } : node;
      })
    );
    setFeedback("Auto layout complete", "success");
  };

  const handleAddNode = (type: string, dataOverrides: Record<string, unknown> = {}): string => {
    const id = `${type}-${Date.now()}`;
    const lastNode = nodesRef.current[nodesRef.current.length - 1];
    const sourceNode = selectedNode || lastNode || null;
    const sourcePosition = sourceNode?.position || findNextNodePosition(nodesRef.current);
    const newNode: Node = {
      id,
      type: "action",
      position: sourceNode
        ? {
            x: sourcePosition.x + 250,
            y: sourcePosition.y
          }
        : findNextNodePosition(nodesRef.current),
      data: { label: type.replace(/_/g, " "), type, ...dataOverrides }
    };
    nodesRef.current = [...nodesRef.current, newNode];
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);

    if (sourceNode) {
      setEdges((eds) => [...eds, { id: `e-${sourceNode.id}-${id}`, source: sourceNode.id, target: id }]);
    }

    setStatus(`Added node: ${newNode.data?.label || type}`);
    return id;
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    const selectedType = String(selectedNode.data?.type || "");
    if (selectedType === "start") {
      setFeedback("Start node cannot be deleted", "error");
      return;
    }
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
    setFeedback(`Deleted node ${selectedNode.id}`, "info");
  };

  const validateWorkflowDefinition = (definition: WorkflowDefinition) => {
    const validationErrors: string[] = [];
    const allNodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
    const allEdges = Array.isArray(definition?.edges) ? definition.edges : [];
    const startNode = allNodes.find((node: any) => String(node?.data?.type || node?.type || "") === "start");

    if (!startNode) {
      validationErrors.push("Workflow is missing a Start node.");
    }

    const outgoing = new Map<string, string[]>();
    allEdges.forEach((edge: any) => {
      const source = String(edge?.source || "");
      const target = String(edge?.target || "");
      if (!source || !target) return;
      const list = outgoing.get(source) || [];
      list.push(target);
      outgoing.set(source, list);
    });

    if (startNode) {
      const visited = new Set<string>();
      const queue = [startNode.id];
      while (queue.length) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        const next = outgoing.get(current) || [];
        next.forEach((nodeId) => {
          if (!visited.has(nodeId)) queue.push(nodeId);
        });
      }
      allNodes.forEach((node: any) => {
        const type = String(node?.data?.type || "");
        if (type === "start") return;
        if (!visited.has(node.id)) {
          validationErrors.push(`Node "${node.data?.label || node.id}" is disconnected from Start.`);
        }
      });
    }

    const requiredNodeFields: Record<string, string[]> = {
      set_variable: ["key"],
      http_request: ["url"],
      transform_llm: ["inputKey", "outputKey"],
      validate_record: ["inputKey"],
      submit_guard: ["inputKey"],
      loop_iterate: ["inputKey"],
      parallel_execute: ["tasks"],
      data_import_csv: ["outputKey"],
      integration_request: ["integrationId"],
      playwright_navigate: ["url"],
      playwright_click: ["selector"],
      playwright_fill: ["selector", "value"],
      playwright_extract: ["selector", "saveAs"],
      playwright_visual_assert: ["baselineName"],
      desktop_type: ["value"],
      desktop_click_image: ["imagePath"],
      desktop_wait_for_image: ["imagePath"]
    };

    allNodes.forEach((node: any) => {
      const nodeType = String(node?.data?.type || "");
      const fields = requiredNodeFields[nodeType] || [];
      fields.forEach((field) => {
        const value = node?.data?.[field];
        if (field === "tasks") {
          if (!Array.isArray(value) || value.length === 0) {
            validationErrors.push(`Node "${node.data?.label || node.id}" requires at least one task.`);
          }
          return;
        }
        if (value === undefined || value === null || String(value).trim() === "") {
          validationErrors.push(`Node "${node.data?.label || node.id}" is missing "${field}".`);
        }
      });

      if (nodeType === "parallel_execute" || nodeType === "loop_iterate") {
        const tasks = Array.isArray(node?.data?.tasks) ? node.data.tasks : [];
        const inlineTaskRequiredFields: Record<string, string[]> = {
          http_request: ["url"],
          set_variable: ["key"],
          transform_llm: ["inputKey", "outputKey"],
          validate_record: ["inputKey"],
          submit_guard: ["inputKey"]
        };

        tasks.forEach((task: any, index: number) => {
          const taskType = String(task?.type || "").trim();
          if (!taskType) {
            validationErrors.push(
              `Node "${node.data?.label || node.id}" task #${index + 1} is missing "type".`
            );
            return;
          }
          const taskFields = inlineTaskRequiredFields[taskType];
          if (!taskFields) {
            validationErrors.push(
              `Node "${node.data?.label || node.id}" task #${index + 1} has unsupported type "${taskType}".`
            );
            return;
          }
          taskFields.forEach((field) => {
            const value = task?.[field];
            if (value === undefined || value === null || String(value).trim() === "") {
              validationErrors.push(
                `Node "${node.data?.label || node.id}" task #${index + 1} is missing "${field}".`
              );
            }
          });
        });
      }
    });

    const secretRegex = /\{\{secret:([A-Za-z0-9_\-:.]+)\}\}/g;
    const secretKeys = new Set(secrets.map((item) => String(item.key || "")));
    allNodes.forEach((node: any) => {
      const serialized = JSON.stringify(node?.data || {});
      const matches = serialized.matchAll(secretRegex);
      for (const match of matches) {
        const key = match[1];
        if (!secretKeys.has(key)) {
          validationErrors.push(`Node "${node.data?.label || node.id}" references missing secret "${key}".`);
        }
      }
    });

    return validationErrors;
  };

  const handleStartRecorder = async () => {
    setFeedback("Starting recorder...", "info");
    const session = await startRecorder();
    const ws = new WebSocket(`${API_URL.replace("http", "ws")}${session.wsUrl}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "recorder:event") {
        const payload = message.payload;
        if (payload.type === "click") {
          handleAddNode("playwright_click", { selector: payload.selector, retryCount: 2, timeoutMs: 15000 });
        }
        if (payload.type === "fill") {
          handleAddNode("playwright_fill", {
            selector: payload.selector,
            value: payload.value,
            retryCount: 2,
            timeoutMs: 15000
          });
        }
      }
    };

    ws.onopen = () => setFeedback("Recorder connected", "success");
    ws.onerror = () => setFeedback("Recorder error", "error");
  };

  const handleDesktopRecordStart = async () => {
    setFeedback("Starting desktop recorder...", "info");
    await startDesktopRecorder("session");
    setDesktopRecording(true);
    setFeedback("Desktop recording active", "success");
  };

  const handleDesktopRecordStop = async () => {
    const result = await stopDesktopRecorder();
    setDesktopRecording(false);
    setFeedback("Desktop recording stopped", "success");
    const events = result.events || [];
    events.forEach((event: any) => {
      if (event.type === "desktop_click_image") {
        handleAddNode("desktop_click_image", {
          imagePath: event.imagePath,
          x: event.x,
          y: event.y,
          button: event.button,
          confidence: event.confidence ?? 0.8,
          retryCount: 2
        });
      }
      if (event.type === "desktop_type") {
        handleAddNode("desktop_type", { value: event.value, retryCount: 1 });
      }
    });
  };

  const loadRun = async (runId: string) => {
    const [run, diff] = await Promise.all([getRun(runId), getRunDiff(runId)]);
    setActiveRun(run);
    setRunDiff(diff);
  };

  const getWaitingApprovalNodeId = (run: any) => {
    const logs = Array.isArray(run?.logs) ? run.logs : [];
    const waiting = [...logs].reverse().find((entry: any) => entry.status === "waiting_approval");
    return waiting?.nodeId || null;
  };

  const handleApprove = async () => {
    if (!activeRun) return;
    const waitingNode = getWaitingApprovalNodeId(activeRun);
    const nodeId = waitingNode || selectedNode?.id;
    if (!nodeId) {
      setFeedback("No waiting approval node found", "error");
      return;
    }
    await approveRun(activeRun.id, nodeId, true);
    setFeedback(`Approved node ${nodeId}`, "success");
    if (activeWorkflow) {
      await refreshWorkflowMeta(activeWorkflow.id);
    }
    await refreshDashboard();
  };

  const handleCopyRunContext = async () => {
    if (!activeRun?.context) {
      setFeedback("No run context available", "error");
      return;
    }
    const text = JSON.stringify(activeRun.context, null, 2);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(text);
      setFeedback("Run context copied", "success");
    } catch {
      setFeedback("Unable to copy run context", "error");
    }
  };

  const handleSaveSecret = async () => {
    if (!secretKey) return;
    await saveSecret(secretKey, secretValue);
    setSecretKey("");
    setSecretValue("");
    const list = await getSecrets();
    setSecrets(list);
    setFeedback("Secret saved", "success");
  };

  const handleCreateIntegration = async () => {
    const name = integrationName.trim();
    if (!name) {
      setFeedback("Integration name is required", "error");
      return;
    }
    let config: Record<string, unknown> = {};
    const raw = integrationConfigText.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          config = parsed as Record<string, unknown>;
        } else {
          throw new Error("Config must be a JSON object");
        }
      } catch (error) {
        setFeedback(`Invalid integration config JSON: ${String(error)}`, "error");
        return;
      }
    }
    const created = await createIntegration({
      name,
      type: integrationType as any,
      config
    });
    setIntegrations((prev) => [created as IntegrationItem, ...prev]);
    setFeedback("Integration created", "success");
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    await deleteIntegration(integrationId);
    setIntegrations((prev) => prev.filter((entry) => entry.id !== integrationId));
    setFeedback("Integration deleted", "success");
  };

  const handleTestIntegration = async (integrationId: string) => {
    const result = await testIntegration(integrationId);
    if (result?.ok) {
      setFeedback(`Integration OK: ${result.message}`, "success");
    } else {
      setFeedback(`Integration test failed: ${result?.message || "Unknown error"}`, "error");
    }
  };

  const handleImportCsvPreview = async () => {
    const result = await importCsv({
      text: csvImportText.trim() || undefined,
      filePath: csvImportPath.trim() || undefined
    });
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const outputKey = selectedNode?.id ? `${selectedNode.id}_rows` : "csvRows";
    const nodeId = handleAddNode("data_import_csv", {
      label: "CSV Import",
      text: csvImportText.trim() || undefined,
      filePath: csvImportPath.trim() || undefined,
      outputKey
    });
    setFeedback(`CSV parsed (${rows.length} rows). Added node ${nodeId}.`, "success");
  };

  const handleBeginTwoFactorSetup = async () => {
    const setup = await beginTwoFactorSetup();
    setTwoFactorSetup(setup as TwoFactorSetupPayload);
    setTwoFactorStatus((prev) => ({ enabled: prev?.enabled || false, pending: true }));
    setFeedback("2FA setup created. Scan QR and verify token.", "info");
  };

  const handleVerifyTwoFactorSetup = async () => {
    const token = twoFactorToken.trim();
    if (!token) {
      setFeedback("Enter a 2FA token to verify setup", "error");
      return;
    }
    await verifyTwoFactorSetup(token);
    const status = await getTwoFactorStatus();
    setTwoFactorStatus(status as TwoFactorStatus);
    setTwoFactorSetup(null);
    setTwoFactorToken("");
    setFeedback("2FA enabled", "success");
  };

  const handleDisableTwoFactor = async () => {
    const token = twoFactorToken.trim();
    if (!token) {
      setFeedback("Enter current 2FA token to disable", "error");
      return;
    }
    await disableTwoFactor(token);
    const status = await getTwoFactorStatus();
    setTwoFactorStatus(status as TwoFactorStatus);
    setTwoFactorSetup(null);
    setTwoFactorToken("");
    setFeedback("2FA disabled", "success");
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserPassword) {
      setFeedback("Username and password are required", "error");
      return;
    }
    await createAdminUser({
      username: newUserName.trim(),
      password: newUserPassword,
      role: newUserRole
    });
    setNewUserName("");
    setNewUserPassword("");
    await refreshAdmin();
    setFeedback("User created", "success");
  };

  const handleToggleUser = async (user: any) => {
    await updateAdminUser(user.username, { disabled: !user.disabled });
    await refreshAdmin();
    setFeedback(user.disabled ? "User enabled" : "User disabled", "success");
  };

  const handlePromoteUser = async (user: any) => {
    const role = user.role === "operator" ? "viewer" : user.role === "viewer" ? "admin" : "operator";
    await updateAdminUser(user.username, { role });
    await refreshAdmin();
    setFeedback(`Role updated to ${role}`, "success");
  };

  const handleDeleteUser = async (username: string) => {
    await deleteAdminUser(username);
    await refreshAdmin();
    setFeedback("User deleted", "success");
  };

  const handleCreateWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim()) {
      setFeedback("Webhook name and URL are required", "error");
      return;
    }
    if (!webhookEventSelection.length) {
      setFeedback("Select at least one webhook event", "error");
      return;
    }
    await createWebhook({
      name: webhookName.trim(),
      url: webhookUrl.trim(),
      events: webhookEventSelection,
      secret: webhookSecret.trim() || undefined
    });
    setWebhookName("Run Alerts");
    setWebhookUrl("");
    setWebhookSecret("");
    await refreshAdmin();
    setFeedback("Webhook created", "success");
  };

  const handleToggleWebhook = async (hook: any) => {
    await updateWebhook(hook.id, { enabled: !hook.enabled });
    await refreshAdmin();
    setFeedback(hook.enabled ? "Webhook disabled" : "Webhook enabled", "success");
  };

  const handleDeleteWebhook = async (id: string) => {
    await deleteWebhook(id);
    await refreshAdmin();
    setFeedback("Webhook deleted", "success");
  };

  const handleTestWebhook = async (id: string) => {
    const result = await testWebhook(id);
    setFeedback(`Webhook test sent (${result.delivered || 0}/${result.attempted || 1})`, "info");
    await refreshAdmin();
  };

  const handleEnableViewerReadOnly = async () => {
    await updateRole("viewer", ["workflows:read", "templates:read", "metrics:read", "secrets:read"]);
    await refreshAdmin();
    setFeedback("Viewer role updated", "success");
  };

  const handleRefreshAudit = async () => {
    const events = await getAuditEvents({ limit: 40 });
    setAuditEvents(Array.isArray(events) ? events : []);
    setFeedback("Audit log refreshed", "info");
  };

  const handleRenameWorkflow = async () => {
    if (!activeWorkflow || !workflowName.trim()) return;
    const updated = await updateWorkflow(activeWorkflow.id, { name: workflowName.trim() });
    setActiveWorkflow(updated);
    setWorkflowList((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    setFeedback("Workflow renamed", "success");
  };

  const handleAddWorkflowComment = async () => {
    if (!activeWorkflow) return;
    const message = commentDraft.trim();
    if (!message) {
      setFeedback("Comment message is required", "error");
      return;
    }
    const created = await createWorkflowComment(activeWorkflow.id, {
      message,
      nodeId: selectedNode?.id
    });
    setCommentDraft("");
    setWorkflowComments((prev) => [...prev, created]);
    setFeedback("Comment added", "success");
    await refreshWorkflowCollaboration(activeWorkflow.id);
  };

  const handleDeleteWorkflowComment = async (commentId: string) => {
    if (!activeWorkflow) return;
    await deleteWorkflowComment(activeWorkflow.id, commentId);
    setWorkflowComments((prev) => prev.filter((comment) => comment.id !== commentId));
    setFeedback("Comment deleted", "success");
    await refreshWorkflowCollaboration(activeWorkflow.id);
  };

  const handleDeleteWorkflow = async () => {
    if (!activeWorkflow) return;
    const ok = window.confirm(`Delete workflow "${activeWorkflow.name}" and all of its runs?`);
    if (!ok) return;
    await deleteWorkflow(activeWorkflow.id);
    setActiveWorkflow(null);
    setNodes(defaultDefinition.nodes as Node[]);
    setEdges(defaultDefinition.edges as Edge[]);
    setRuns([]);
    setActiveRun(null);
    setRunDiff(null);
    setVersions([]);
    setRollbackVersion("");
    setCollabPresence([]);
    setWorkflowComments([]);
    setWorkflowHistory(null);
    setCommentDraft("");
    await refreshWorkflows(true);
    setFeedback("Workflow deleted", "success");
    await refreshDashboard();
  };

  const handleApplySchedulePreset = () => {
    if (!activeSchedulePreset) {
      setFeedback("Select a schedule preset first", "error");
      return;
    }
    setScheduleCron(activeSchedulePreset.cron);
    setScheduleName(activeSchedulePreset.name);
    setFeedback(`Applied preset: ${activeSchedulePreset.name}`, "info");
  };

  const parseMaintenanceWeekdays = () => {
    const parsed = maintenanceWeekdays
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    return Array.from(new Set(parsed));
  };

  const handleCreateSchedule = async () => {
    if (!activeWorkflow) {
      setFeedback("Select a workflow first", "error");
      return;
    }
    const dependsOnScheduleId = scheduleDependsOnId.trim();
    if (dependsOnScheduleId && activeWorkflow && schedules.some((row) => row.id === dependsOnScheduleId && row.workflowId !== activeWorkflow.id)) {
      setFeedback("Dependency schedule must belong to the selected workflow", "error");
      return;
    }
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (maintenanceEnabled && (!timeRegex.test(maintenanceStart.trim()) || !timeRegex.test(maintenanceEnd.trim()))) {
      setFeedback("Maintenance window must use HH:MM format", "error");
      return;
    }
    const weekdays = parseMaintenanceWeekdays();
    const maintenanceWindows =
      maintenanceEnabled && maintenanceStart.trim() && maintenanceEnd.trim()
        ? [
            {
              start: maintenanceStart.trim(),
              end: maintenanceEnd.trim(),
              weekdays: weekdays.length ? weekdays : undefined
            }
          ]
        : undefined;
    const timezone = scheduleTimezone || systemTime?.timezone;
    const created = await createSchedule({
      workflowId: activeWorkflow.id,
      name: scheduleName.trim() || "Scheduled run",
      cron: scheduleCron.trim(),
      timezone,
      enabled: true,
      testMode: scheduleTestMode,
      dependsOnScheduleId: dependsOnScheduleId || undefined,
      maintenanceWindows
    });
    setSchedules((prev) => [created, ...prev]);
    await refreshSchedules(activeWorkflow.id);
    setFeedback("Schedule created", "success");
    await refreshDashboard();
  };

  const handleToggleSchedule = async (schedule: any) => {
    const updated = await updateSchedule(schedule.id, { enabled: !schedule.enabled });
    setSchedules((prev) => prev.map((row) => (row.id === schedule.id ? updated : row)));
    if (activeWorkflow) {
      await refreshSchedules(activeWorkflow.id);
    }
    setFeedback(updated.enabled ? "Schedule enabled" : "Schedule disabled", "success");
    await refreshDashboard();
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteSchedule(scheduleId);
    setSchedules((prev) => prev.filter((row) => row.id !== scheduleId));
    if (activeWorkflow) {
      await refreshSchedules(activeWorkflow.id);
    }
    setFeedback("Schedule deleted", "success");
    await refreshDashboard();
  };

  const handleRunScheduleNow = async (scheduleId: string) => {
    const result = await runScheduleNow(scheduleId);
    setFeedback(result.executed ? "Scheduled run queued" : "Schedule already running", "info");
    await refreshDashboard();
    if (activeWorkflow) {
      await refreshWorkflowMeta(activeWorkflow.id);
      await refreshSchedules(activeWorkflow.id);
    }
  };

  const handleSaveWorkflowFile = () => {
    if (!activeWorkflow) {
      setFeedback("Select a workflow first", "error");
      return;
    }
    const payload = {
      name: workflowName.trim() || activeWorkflow.name,
      definition: buildCurrentDefinition(),
      exportedAt: new Date().toISOString()
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (payload.name || "workflow").replace(/[^a-z0-9-_]+/gi, "_");
    a.href = url;
    a.download = `${safeName}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(`Workflow exported: ${a.download}`, "success");
  };

  const handleLoadWorkflowClick = () => {
    importInputRef.current?.click();
  };

  const handleLoadWorkflowFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const definition = parsed?.definition ?? parsed;
    const validDefinition =
      definition && typeof definition === "object" && Array.isArray(definition.nodes) && Array.isArray(definition.edges);
    if (!validDefinition) {
      throw new Error("Invalid workflow file: expected { definition: { nodes, edges } }");
    }
    const importedNameBase = String(parsed?.name || file.name.replace(/\.workflow\.json$|\.json$/i, "") || "Imported Workflow");
    const importedName = importedNameBase.trim() || "Imported Workflow";
    const created = await createWorkflow({ name: importedName, definition });
    setWorkflowList((list) => [created, ...list]);
    await selectWorkflow(created);
    setFeedback(`Workflow loaded from ${file.name}`, "success");
  };

  const buildCurrentDefinition = () => {
    const existing = activeWorkflow?.draftDefinition || activeWorkflow?.definition || defaultDefinition;
    return {
      ...defaultDefinition,
      ...existing,
      nodes,
      edges
    };
  };

  const miniMapNodeColor = (node: any) => {
    const status = String(node?.data?.__runStatus || "");
    if (status === "running") return "#2cb9b0";
    if (status === "succeeded") return "#3abf6f";
    if (status === "failed") return "#d64e3a";
    if (status === "skipped") return "#6a7682";
    if (status === "queued") return "#f5b01f";
    return "#304050";
  };

  const currentPermissions: string[] = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
  const isAdminUser = currentPermissions.includes("*");
  const canManageUsers = isAdminUser || currentPermissions.includes("users:manage");
  const canManageRoles = isAdminUser || currentPermissions.includes("roles:manage");
  const canManageWebhooks = isAdminUser || currentPermissions.includes("webhooks:manage");
  const canReadAudit = isAdminUser || currentPermissions.includes("audit:read");
  const availableRoleNames = roles.map((entry) => entry.role);

  if (!token) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>RPA Local</h1>
          <p>Local automation studio with resilient runs and approvals.</p>
          <div className="login-fields">
            <input placeholder="Username" id="username" />
            <input placeholder="Password" id="password" type="password" />
            <input
              placeholder="2FA code (if enabled)"
              id="totp"
              value={loginTotpCode}
              onChange={(e) => setLoginTotpCode(e.target.value)}
            />
            <button
              disabled={isActionLoading("login")}
              className={isActionLoading("login") ? "is-loading" : ""}
              onClick={() => {
                withActionLoading("login", async () => {
                  const username = (document.getElementById("username") as HTMLInputElement).value;
                  const password = (document.getElementById("password") as HTMLInputElement).value;
                  const totp = (document.getElementById("totp") as HTMLInputElement).value;
                  await handleLogin(username, password, totp);
                });
              }}
            >
              {isActionLoading("login") ? "Signing in..." : "Sign in"}
            </button>
            {status && <span className="status">{status}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        workflows={workflowList}
        activeId={activeWorkflow?.id}
        onSelect={(wf) => {
          selectWorkflow(wf).catch(showError);
        }}
        onCreate={() => {
          withActionLoading("create-workflow", handleCreateWorkflow);
        }}
      >
        <small>
          User: <strong>{currentUser?.username || "-"}</strong> ({currentUser?.role || "unknown"})
        </small>
        <h3>Workflow</h3>
        <input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="Workflow name" />
        <button onClick={() => handleRenameWorkflow().catch(showError)}>Rename</button>
        <button onClick={handleSaveWorkflowFile}>Save Workflow File</button>
        <button onClick={() => handleLoadWorkflowClick()}>Load Workflow File</button>
        <button className="danger" onClick={() => handleDeleteWorkflow().catch(showError)}>
          Delete Workflow
        </button>
        <button className="secondary" onClick={handleLogout}>
          Logout
        </button>
        <h3>Security</h3>
        <small>
          2FA:{" "}
          {twoFactorStatus?.enabled ? "Enabled" : twoFactorStatus?.pending ? "Pending verification" : "Disabled"}
        </small>
        {!twoFactorStatus?.enabled ? (
          <button onClick={() => handleBeginTwoFactorSetup().catch(showError)}>Start 2FA Setup</button>
        ) : null}
        {twoFactorSetup?.qrCodeUrl ? (
          <img className="twofactor-qr" src={twoFactorSetup.qrCodeUrl} alt="2FA QR" />
        ) : null}
        {twoFactorSetup?.secret ? <small>Secret: {twoFactorSetup.secret}</small> : null}
        <input
          value={twoFactorToken}
          onChange={(e) => setTwoFactorToken(e.target.value)}
          placeholder="2FA token"
        />
        {twoFactorSetup ? (
          <button onClick={() => handleVerifyTwoFactorSetup().catch(showError)}>Verify 2FA Setup</button>
        ) : null}
        {twoFactorStatus?.enabled ? (
          <button className="danger" onClick={() => handleDisableTwoFactor().catch(showError)}>
            Disable 2FA
          </button>
        ) : null}
        <h3>Collaboration</h3>
        <small>Live presence</small>
        <div className="collab-presence">
          {collabPresence.length ? (
            collabPresence.slice(0, 10).map((entry) => (
              <div key={entry.clientId} className="collab-item">
                <strong>{entry.username}</strong>
                <small>
                  {entry.status}
                  {entry.currentNodeId ? ` · ${entry.currentNodeId}` : ""}
                </small>
              </div>
            ))
          ) : (
            <small>No active viewers</small>
          )}
        </div>
        <small>Workflow comments</small>
        <input
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          placeholder={selectedNode ? `Comment on ${selectedNode.id}` : "Add a workflow comment"}
        />
        <button onClick={() => handleAddWorkflowComment().catch(showError)}>Add Comment</button>
        <div className="collab-comments">
          {workflowComments.slice(-8).reverse().map((comment) => (
            <div key={comment.id} className="collab-item">
              <strong>{comment.authorUsername}</strong>
              <small>
                {new Date(comment.createdAt).toLocaleString()}
                {comment.nodeId ? ` · ${comment.nodeId}` : ""}
              </small>
              <small>{comment.message}</small>
              <button onClick={() => handleDeleteWorkflowComment(comment.id).catch(showError)}>Delete</button>
            </div>
          ))}
          {!workflowComments.length ? <small>No comments yet</small> : null}
        </div>
        <small>Change history</small>
        <div className="collab-history">
          {(workflowHistory?.events || []).slice(0, 8).map((event) => (
            <div key={event.id} className="collab-item">
              <strong>{event.action}</strong>
              <small>
                {new Date(event.at).toLocaleString()} · {event.actorUsername}
              </small>
              {event.message ? <small>{event.message}</small> : null}
            </div>
          ))}
          {!workflowHistory?.events?.length ? <small>No history yet</small> : null}
        </div>
        <h3>Templates</h3>
        <input
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          placeholder="Search templates"
        />
        <select value={templateCategoryFilter} onChange={(e) => setTemplateCategoryFilter(e.target.value)}>
          {templateCategories.map((category) => (
            <option key={category} value={category}>
              {category === "all" ? "All categories" : category}
            </option>
          ))}
        </select>
        <div className="template-list">
          {filteredTemplates.slice(0, 8).map((template) => (
            <button
              key={template.id}
              className={selectedTemplateId === template.id ? "template-item selected" : "template-item"}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <strong>{template.name}</strong>
              <small>
                {template.category} · {template.difficulty} · {template.nodes || 0} nodes
              </small>
            </button>
          ))}
          {!filteredTemplates.length ? <small>No templates match your filters.</small> : null}
        </div>
        {selectedTemplate ? (
          <div className="template-preview">
            <strong>{selectedTemplate.name}</strong>
            <small>{selectedTemplate.description}</small>
            <small>{selectedTemplate.useCase}</small>
            <small>{Array.isArray(selectedTemplate.tags) ? selectedTemplate.tags.join(", ") : ""}</small>
          </div>
        ) : null}
        <input
          value={templateWorkflowName}
          onChange={(e) => setTemplateWorkflowName(e.target.value)}
          placeholder="New workflow name (optional)"
        />
        <button
          disabled={isActionLoading("create-template")}
          className={isActionLoading("create-template") ? "is-loading" : ""}
          onClick={() => withActionLoading("create-template", handleCreateFromTemplate)}
        >
          {isActionLoading("create-template") ? "Creating..." : "Create From Template"}
        </button>
        <h3>Integrations</h3>
        <input
          value={integrationName}
          onChange={(e) => setIntegrationName(e.target.value)}
          placeholder="Integration name"
        />
        <select value={integrationType} onChange={(e) => setIntegrationType(e.target.value)}>
          <option value="http_api">HTTP API</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="google_sheets">Google Sheets</option>
          <option value="airtable">Airtable</option>
          <option value="s3">S3</option>
        </select>
        <textarea
          value={integrationConfigText}
          onChange={(e) => setIntegrationConfigText(e.target.value)}
          rows={4}
          placeholder='{"baseUrl":"https://example.com"}'
        />
        <button onClick={() => handleCreateIntegration().catch(showError)}>Create Integration</button>
        <div className="integration-list">
          {integrations.slice(0, 8).map((integration) => (
            <div key={integration.id} className="schedule-item">
              <div>
                <strong>{integration.name}</strong>
                <small>{integration.type}</small>
              </div>
              <div className="schedule-actions">
                <button onClick={() => handleTestIntegration(integration.id).catch(showError)}>Test</button>
                <button className="danger" onClick={() => handleDeleteIntegration(integration.id).catch(showError)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!integrations.length ? <small>No integrations configured.</small> : null}
        </div>
        <small>CSV import helper</small>
        <textarea
          value={csvImportText}
          onChange={(e) => setCsvImportText(e.target.value)}
          rows={3}
          placeholder={"name,email\nAlice,alice@example.com"}
        />
        <input
          value={csvImportPath}
          onChange={(e) => setCsvImportPath(e.target.value)}
          placeholder="CSV file path (optional)"
        />
        <button onClick={() => handleImportCsvPreview().catch(showError)}>Parse CSV + Add Node</button>
        <h3>Schedules</h3>
        <div className="schedule-preset-row">
          <select value={selectedSchedulePreset} onChange={(e) => setSelectedSchedulePreset(e.target.value)}>
            <option value="">Select preset</option>
            {schedulePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button onClick={handleApplySchedulePreset}>Use Preset</button>
        </div>
        {activeSchedulePreset ? <small>{activeSchedulePreset.description}</small> : null}
        <input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="Schedule name" />
        <input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="Cron (local time)" />
        <input
          value={scheduleTimezone}
          onChange={(e) => setScheduleTimezone(e.target.value)}
          placeholder={systemTime?.timezone || "Timezone"}
        />
        <select value={scheduleDependsOnId} onChange={(e) => setScheduleDependsOnId(e.target.value)}>
          <option value="">No dependency</option>
          {schedules
            .filter((row) => row.workflowId === activeWorkflow?.id)
            .map((row) => (
              <option key={row.id} value={row.id}>
                Depends on: {row.name}
              </option>
            ))}
        </select>
        <label className="inline-option">
          <input type="checkbox" checked={maintenanceEnabled} onChange={(e) => setMaintenanceEnabled(e.target.checked)} />
          <span>Maintenance window</span>
        </label>
        {maintenanceEnabled ? (
          <>
            <input value={maintenanceStart} onChange={(e) => setMaintenanceStart(e.target.value)} placeholder="Window start HH:MM" />
            <input value={maintenanceEnd} onChange={(e) => setMaintenanceEnd(e.target.value)} placeholder="Window end HH:MM" />
            <input
              value={maintenanceWeekdays}
              onChange={(e) => setMaintenanceWeekdays(e.target.value)}
              placeholder="Weekdays CSV (0-6), e.g. 1,2,3,4,5"
            />
          </>
        ) : null}
        {schedulePreview ? (
          <small>
            Next run: {schedulePreview.nextRunAtLocal || "No upcoming run found"} ({schedulePreview.timezone})
          </small>
        ) : null}
        <label className="inline-option">
          <input type="checkbox" checked={scheduleTestMode} onChange={(e) => setScheduleTestMode(e.target.checked)} />
          <span>Run in test mode</span>
        </label>
        <button
          disabled={isActionLoading("create-schedule")}
          className={isActionLoading("create-schedule") ? "is-loading" : ""}
          onClick={() => withActionLoading("create-schedule", handleCreateSchedule)}
        >
          {isActionLoading("create-schedule") ? "Adding..." : "Add Schedule"}
        </button>
        <div className="schedule-list">
          {schedules.slice(0, 8).map((schedule) => (
            <div key={schedule.id} className="schedule-item">
              <div>
                <strong>{schedule.name}</strong>
                <small>
                  {schedule.cron} ({schedule.timezone})
                </small>
                {schedule.dependsOnScheduleId ? <small>Depends on: {schedule.dependsOnScheduleId}</small> : null}
                {Array.isArray(schedule.maintenanceWindows) && schedule.maintenanceWindows.length ? (
                  <small>
                    Maintenance: {schedule.maintenanceWindows[0]?.start} - {schedule.maintenanceWindows[0]?.end}
                  </small>
                ) : null}
                <small>Next run: {schedule.nextRunAtLocal || "n/a"}</small>
                {schedule.lastRunAt ? <small>Last run: {new Date(schedule.lastRunAt).toLocaleString()}</small> : null}
                {schedule.lastRunStatus ? <small>Last status: {schedule.lastRunStatus}</small> : null}
                {schedule.lastRunError ? <small>Error: {schedule.lastRunError}</small> : null}
              </div>
              <div className="schedule-actions">
                <button onClick={() => handleRunScheduleNow(schedule.id).catch(showError)}>Run now</button>
                <button onClick={() => handleToggleSchedule(schedule).catch(showError)}>
                  {schedule.enabled ? "Disable" : "Enable"}
                </button>
                <button className="danger" onClick={() => handleDeleteSchedule(schedule.id).catch(showError)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <h4>Upcoming Calendar</h4>
        <div className="schedule-calendar">
          {upcomingScheduleGroups.slice(0, 8).map((group) => (
            <div key={group.date} className="schedule-day">
              <strong>{group.date}</strong>
              {group.items.slice(0, 8).map((item) => (
                <small key={`${item.scheduleId}-${item.atUtc}`}>
                  {item.atLocal.split(" ")[1] || item.atLocal} · {item.scheduleName}
                </small>
              ))}
            </div>
          ))}
          {!upcomingScheduleGroups.length ? <small>No upcoming schedule runs</small> : null}
        </div>
        {canManageUsers ? (
          <>
            <h3>Users</h3>
            <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Username" />
            <input
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              type="password"
              placeholder="Password (min 8)"
            />
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
              {(availableRoleNames.length ? availableRoleNames : ["operator", "viewer", "admin"]).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button onClick={() => handleCreateUser().catch(showError)}>Create User</button>
            <div className="schedule-list">
              {adminUsers.slice(0, 8).map((user) => (
                <div key={user.username} className="schedule-item">
                  <div>
                    <strong>{user.username}</strong>
                    <small>
                      {user.role} {user.disabled ? "(disabled)" : ""}
                    </small>
                  </div>
                  <div className="schedule-actions">
                    <button onClick={() => handlePromoteUser(user).catch(showError)}>Cycle Role</button>
                    <button onClick={() => handleToggleUser(user).catch(showError)}>
                      {user.disabled ? "Enable" : "Disable"}
                    </button>
                    <button className="danger" onClick={() => handleDeleteUser(user.username).catch(showError)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {canManageRoles ? (
          <>
            <h3>RBAC</h3>
            <button onClick={() => handleEnableViewerReadOnly().catch(showError)}>Apply Viewer Read-Only Preset</button>
          </>
        ) : null}
        {canManageWebhooks ? (
          <>
            <h3>Webhooks</h3>
            <input value={webhookName} onChange={(e) => setWebhookName(e.target.value)} placeholder="Webhook name" />
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Signing secret (optional)"
            />
            <select
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                setWebhookEventSelection((prev) => (prev.includes(value) ? prev : [...prev, value]));
                e.target.value = "";
              }}
            >
              <option value="">Add event</option>
              {webhookEvents
                .filter((event) => !webhookEventSelection.includes(event))
                .map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
            </select>
            <div className="selected-events">
              {webhookEventSelection.map((event) => (
                <button
                  key={event}
                  className="chip"
                  onClick={() => setWebhookEventSelection((prev) => prev.filter((entry) => entry !== event))}
                >
                  {event} x
                </button>
              ))}
            </div>
            <button onClick={() => handleCreateWebhook().catch(showError)}>Create Webhook</button>
            <div className="schedule-list">
              {webhookList.slice(0, 8).map((hook) => (
                <div key={hook.id} className="schedule-item">
                  <div>
                    <strong>{hook.name}</strong>
                    <small>{hook.url}</small>
                    <small>{(hook.events || []).join(", ")}</small>
                    <small>
                      Last: {hook.lastDeliveryStatus || "never"}
                      {hook.lastDeliveryError ? ` (${hook.lastDeliveryError})` : ""}
                    </small>
                  </div>
                  <div className="schedule-actions">
                    <button onClick={() => handleTestWebhook(hook.id).catch(showError)}>Test</button>
                    <button onClick={() => handleToggleWebhook(hook).catch(showError)}>
                      {hook.enabled ? "Disable" : "Enable"}
                    </button>
                    <button className="danger" onClick={() => handleDeleteWebhook(hook.id).catch(showError)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {canReadAudit ? (
          <>
            <h3>Audit Log</h3>
            <button onClick={() => handleRefreshAudit().catch(showError)}>Refresh Audit</button>
            <div className="schedule-list">
              {auditEvents.slice(0, 20).map((event) => (
                <div key={event.id} className="schedule-item">
                  <div>
                    <strong>
                      {event.success ? "OK" : "FAILED"} · {event.action}
                    </strong>
                    <small>
                      {new Date(event.at).toLocaleString()} · {event.actorUsername} ({event.actorRole})
                    </small>
                    <small>
                      {event.resourceType}
                      {event.resourceId ? `/${event.resourceId}` : ""}
                    </small>
                    {event.message ? <small>{event.message}</small> : null}
                  </div>
                </div>
              ))}
              {!auditEvents.length ? <small>No audit events yet.</small> : null}
            </div>
          </>
        ) : null}
        <h3>Versions</h3>
        <select
          value={rollbackVersion}
          onChange={(e) => setRollbackVersion(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select version</option>
          {versions.map((v) => (
            <option key={v.id} value={v.version}>
              v{v.version} ({v.status})
            </option>
          ))}
        </select>
        <button onClick={() => handleRollback().catch(showError)}>Rollback</button>
        <h3>Secrets</h3>
        <input placeholder="Secret key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
        <input
          placeholder="Secret value"
          type="password"
          value={secretValue}
          onChange={(e) => setSecretValue(e.target.value)}
        />
        <button onClick={() => handleSaveSecret().catch(showError)}>Save Secret</button>
        <small>{secrets.length} stored secret keys</small>
      </Sidebar>

      <div className="canvas">
        <input
          ref={importInputRef}
          type="file"
          accept=".json,.workflow.json,application/json"
          style={{ display: "none" }}
          onChange={(event) => handleLoadWorkflowFile(event).catch(showError)}
        />
        <div className="toolbar">
          <div className="toolbar-left">
            {nodeOptions.map((opt) => (
              <button key={opt.type} onClick={() => handleAddNode(opt.type)}>
                + {opt.label}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <button
              disabled={isActionLoading("record-web")}
              className={isActionLoading("record-web") ? "is-loading" : ""}
              onClick={() => withActionLoading("record-web", handleStartRecorder)}
            >
              {isActionLoading("record-web") ? "Starting..." : "Record Web"}
            </button>
            <button
              disabled={isActionLoading("record-desktop")}
              className={isActionLoading("record-desktop") ? "is-loading" : ""}
              onClick={() =>
                withActionLoading("record-desktop", () =>
                  desktopRecording ? handleDesktopRecordStop() : handleDesktopRecordStart()
                )
              }
            >
              {isActionLoading("record-desktop") ? "Working..." : desktopRecording ? "Stop Desktop" : "Record Desktop"}
            </button>
            <button
              disabled={isActionLoading("auto-layout")}
              className={isActionLoading("auto-layout") ? "is-loading" : ""}
              onClick={() => withActionLoading("auto-layout", autoLayoutNodes)}
            >
              Auto Layout
            </button>
            <button onClick={() => setSnapToGrid((value) => !value)}>{snapToGrid ? "Snap: On" : "Snap: Off"}</button>
            <button
              disabled={isActionLoading("save-draft")}
              className={isActionLoading("save-draft") ? "is-loading" : ""}
              onClick={() => withActionLoading("save-draft", handleSave)}
            >
              {isActionLoading("save-draft") ? "Saving..." : "Save Draft"}
            </button>
            <button
              disabled={isActionLoading("publish")}
              className={isActionLoading("publish") ? "is-loading" : ""}
              onClick={() => withActionLoading("publish", handlePublish)}
            >
              {isActionLoading("publish") ? "Publishing..." : "Publish"}
            </button>
            <button
              disabled={isActionLoading("test-run")}
              className={isActionLoading("test-run") ? "is-loading" : ""}
              onClick={() => withActionLoading("test-run", () => runWorkflow(true))}
            >
              {isActionLoading("test-run") ? "Running..." : "Test Run"}
            </button>
            <button
              className={`primary ${isActionLoading("run") ? "is-loading" : ""}`}
              disabled={isActionLoading("run")}
              onClick={() => withActionLoading("run", () => runWorkflow(false))}
            >
              {isActionLoading("run") ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        <div className="metrics-strip">
          <div className="metric-card">
            <span>Local Time</span>
            <strong>{systemTime?.localTime || "-"}</strong>
            <small>{systemTime?.timezone || "unknown timezone"}</small>
          </div>
          <div className="metric-card">
            <span>Success Rate</span>
            <strong>{dashboard?.summary?.successRate ?? 0}%</strong>
            <small>{dashboard?.summary?.succeeded ?? 0} succeeded</small>
          </div>
          <div className="metric-card">
            <span>Total Runs</span>
            <strong>{dashboard?.summary?.totalRuns ?? 0}</strong>
            <small>{dashboard?.summary?.failed ?? 0} failed</small>
          </div>
          <div className="metric-card">
            <span>Avg Duration</span>
            <strong>{dashboard?.summary?.avgDurationMs ?? 0}ms</strong>
            <small>{dashboard?.summary?.running ?? 0} running now</small>
          </div>
          <div className="metric-card">
            <span>Schedules</span>
            <strong>{dashboard?.schedules?.active ?? 0}</strong>
            <small>{dashboard?.schedules?.total ?? 0} total</small>
          </div>
          <div className="metric-card metric-controls">
            <span>Dashboard Window</span>
            <select value={dashboardDays} onChange={(e) => setDashboardDays(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            <button
              disabled={isActionLoading("refresh-dashboard")}
              className={isActionLoading("refresh-dashboard") ? "is-loading" : ""}
              onClick={() => withActionLoading("refresh-dashboard", () => refreshDashboard())}
            >
              {isActionLoading("refresh-dashboard") ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="analytics-strip">
          <div className="analytics-card">
            <strong>Daily Workflow Trend</strong>
            <small>Runs and success rate by day (local timezone)</small>
            <div className="trend-list">
              {dailyTrend.length ? (
                dailyTrend.map((row) => (
                  <div key={row.date} className="trend-row">
                    <span>{row.date}</span>
                    <div className="trend-bar">
                      <div className="trend-fill" style={{ width: `${row.barPct}%` }} />
                    </div>
                    <small>
                      {row.total} runs · {row.successPct}% ok · {row.failed} fail
                    </small>
                  </div>
                ))
              ) : (
                <small>No trend data yet.</small>
              )}
            </div>
          </div>
          <div className="analytics-card">
            <strong>Error Analysis</strong>
            <small>Most frequent failed nodes in selected window</small>
            <div className="trend-list">
              {dashboard?.topFailures?.length ? (
                dashboard.topFailures.slice(0, 8).map((item: any) => (
                  <div key={item.nodeId} className="trend-row">
                    <span>{item.nodeId}</span>
                    <div className="trend-bar">
                      <div className="trend-fill error" style={{ width: `${Math.min(100, item.count * 12)}%` }} />
                    </div>
                    <small>{item.count} failures</small>
                  </div>
                ))
              ) : (
                <small>No failures in selected window.</small>
              )}
            </div>
          </div>
          <div className="analytics-card">
            <strong>Resource Usage</strong>
            <small>Live server process and scheduler snapshot</small>
            <div className="resource-grid">
              <small>RSS Memory: {formatBytes(dashboard?.resources?.rssBytes)}</small>
              <small>Heap Used: {formatBytes(dashboard?.resources?.heapUsedBytes)}</small>
              <small>Heap Total: {formatBytes(dashboard?.resources?.heapTotalBytes)}</small>
              <small>External: {formatBytes(dashboard?.resources?.externalBytes)}</small>
              <small>Load (1m): {dashboard?.resources?.loadAverage1m ?? "-"}</small>
              <small>Load (5m): {dashboard?.resources?.loadAverage5m ?? "-"}</small>
              <small>Load (15m): {dashboard?.resources?.loadAverage15m ?? "-"}</small>
              <small>Active Runs: {dashboard?.resources?.activeRuns ?? 0}</small>
              <small>Uptime: {dashboard?.resources?.uptimeSec ?? 0}s</small>
            </div>
            <div className="hourly-spark">
              {hourlyTrend.slice(0, 24).map((row) => (
                <div key={row.hour} className="hourly-bar" title={`${row.hour}:00 -> ${row.total} runs`}>
                  <div style={{ height: `${row.barPct}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNode(node)}
          nodeTypes={nodeTypes}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          fitView
        >
          <Background gap={20} />
          <MiniMap nodeColor={miniMapNodeColor} />
          <Controls />
        </ReactFlow>

        <div className="run-drawer">
          <div className="run-list">
            <strong>Run Timeline</strong>
            {runs.slice(0, 12).map((run) => (
              <button
                key={run.id}
                className={activeRun?.id === run.id ? "run-item active" : "run-item"}
                onClick={() => loadRun(run.id).catch(showError)}
              >
                <div>{run.status}</div>
                <small>{new Date(run.createdAt).toLocaleString()}</small>
              </button>
            ))}
            {activeRun?.status === "FAILED" ? (
              <button onClick={() => runWorkflow(false, activeRun.id).catch(showError)}>
                Resume From Failed Run
              </button>
            ) : null}
            {activeRun?.status === "WAITING_APPROVAL" ? (
              <button onClick={() => handleApprove().catch(showError)}>Approve Waiting Node</button>
            ) : null}
          </div>
          <div className="run-diff">
            <strong>Diff vs Last Success</strong>
            {!runDiff?.hasBaseline ? <small>No successful baseline yet.</small> : null}
            {(runDiff?.changes || []).slice(0, 8).map((change: any) => (
              <div key={change.nodeId} className="run-item">
                <div>{change.nodeId}</div>
                <small>
                  {change.statusBefore || "-"} {"->"} {change.statusNow || "-"}
                </small>
                <small>
                  {change.durationBefore || 0}ms {"->"} {change.durationNow || 0}ms
                </small>
              </div>
            ))}
            <div className="run-debug-panel">
              <strong>Run Diagnostics</strong>
              {activeRun ? (
                <small>
                  Status: {activeRun.status} · Started:{" "}
                  {activeRun.startedAt ? new Date(activeRun.startedAt).toLocaleString() : "n/a"} · Finished:{" "}
                  {activeRun.finishedAt ? new Date(activeRun.finishedAt).toLocaleString() : "n/a"}
                </small>
              ) : (
                <small>Select a run to inspect diagnostics.</small>
              )}
              {runProgress ? (
                <div className="run-progress">
                  <div className="run-progress-head">
                    <strong>Progress</strong>
                    <small>
                      {runProgress.completed}/{runProgress.total} complete · {runProgress.running} running ·{" "}
                      {runProgress.queued} queued
                    </small>
                  </div>
                  <div className="run-progress-track" aria-label="Run progress">
                    <div className="run-progress-fill" style={{ width: `${runProgress.pct}%` }} />
                  </div>
                </div>
              ) : null}
              {activeRun ? <button onClick={() => handleCopyRunContext().catch(showError)}>Copy Context JSON</button> : null}
              {failedNodes.length ? (
                <div className="debug-list">
                  <strong>Failed Nodes</strong>
                  {failedNodes.map((node) => (
                    <small key={node.nodeId}>
                      {node.nodeId}: {node.error || "Failed"} (attempts: {node.attempts ?? 0}, duration:{" "}
                      {node.durationMs ?? 0}ms)
                    </small>
                  ))}
                </div>
              ) : null}
              {runErrorLogs.length ? (
                <div className="debug-list">
                  <strong>Latest Errors</strong>
                  {runErrorLogs.map((entry: any, idx: number) => (
                    <small key={`${entry?.ts || idx}-${entry?.nodeId || "run"}`}>
                      [{entry?.status || "-"}] {entry?.nodeId || "run"}: {entry?.error || entry?.message || "error"}
                    </small>
                  ))}
                </div>
              ) : null}
              {runContextEntries.length ? (
                <div className="debug-list">
                  <strong>Variable Inspector</strong>
                  {runContextEntries.map((entry) => (
                    <small key={entry.key}>
                      {entry.key} ({entry.type}): {entry.preview}
                    </small>
                  ))}
                </div>
              ) : null}
              {runNetworkLogs.length ? (
                <div className="debug-list">
                  <strong>Network Inspector</strong>
                  {runNetworkLogs.map((entry: any, idx: number) => (
                    <small key={`${entry?.at || idx}-${entry?.nodeId || "net"}`}>
                      [{entry?.kind || "net"}] {entry?.method || "-"} {entry?.url || "-"} {"->"}{" "}
                      {entry?.status ?? "-"} ({entry?.durationMs ?? 0}ms)
                    </small>
                  ))}
                </div>
              ) : null}
              {screenshotArtifacts.length ? (
                <div className="artifact-grid">
                  {screenshotArtifacts.slice(0, 8).map((artifact, idx) => {
                    const url = artifactPathToUrl(API_URL, artifact.path);
                    return (
                      <a
                        key={`${artifact.path || "shot"}-${idx}`}
                        className="artifact-card"
                        href={url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          if (!url) event.preventDefault();
                        }}
                      >
                        {url ? <img src={url} alt={`artifact-${idx}`} /> : <div className="artifact-missing">No preview</div>}
                        <small>
                          {artifact.nodeId || "node"} · attempt {artifact.attempt ?? "-"}
                        </small>
                      </a>
                    );
                  })}
                </div>
              ) : null}
              {domArtifacts.length ? (
                <div className="debug-list">
                  <strong>DOM Snapshots</strong>
                  {domArtifacts.slice(0, 8).map((artifact, idx) => {
                    const url = artifactPathToUrl(API_URL, artifact.path);
                    return (
                      <a
                        key={`${artifact.path || "dom"}-${idx}`}
                        href={url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          if (!url) event.preventDefault();
                        }}
                      >
                        <small>
                          {artifact.nodeId || "node"} · attempt {artifact.attempt ?? "-"} · Open snapshot
                        </small>
                      </a>
                    );
                  })}
                </div>
              ) : null}
              {visualArtifacts.length ? (
                <div className="debug-list">
                  <strong>Visual Regression Artifacts</strong>
                  {visualArtifacts.slice(0, 8).map((artifact, idx) => {
                    const url = artifactPathToUrl(API_URL, artifact.path);
                    return (
                      <a
                        key={`${artifact.path || "visual"}-${idx}`}
                        href={url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          if (!url) event.preventDefault();
                        }}
                      >
                        <small>
                          {artifact.type || "visual"} · {artifact.nodeId || "node"} · Open artifact
                        </small>
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {dashboard?.topFailures?.length ? (
              <div className="top-failures">
                <strong>Top Node Failures</strong>
                {dashboard.topFailures.slice(0, 4).map((item: any) => (
                  <small key={item.nodeId}>
                    {item.nodeId}: {item.count}
                  </small>
                ))}
              </div>
            ) : null}
            {dashboard?.topWorkflows?.length ? (
              <div className="top-failures">
                <strong>Top Workflow Risk</strong>
                {dashboard.topWorkflows.slice(0, 4).map((item: any) => (
                  <small key={item.workflowId}>
                    {item.workflowName}: {item.failed} failed, {item.successRate}% success
                  </small>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="log-window">
          <div className="log-header">Live Logs</div>
          <div className="log-body">
            {uiLogs.length === 0 ? <div className="log-line log-info">No logs yet.</div> : null}
            {uiLogs.map((entry) => (
              <div key={entry.id} className={`log-line log-${entry.level}`}>
                <span>[{entry.at}]</span> {entry.message}
              </div>
            ))}
          </div>
        </div>
        <div className="status-bar">{status || "Ready"}</div>
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.level}`}>
              <span>{toast.message}</span>
              {toast.action ? (
                <button
                  className="toast-action"
                  onClick={() => {
                    toast.action?.onClick();
                    setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <Inspector node={selectedNode} onUpdate={setNodes} />
    </div>
  );
}

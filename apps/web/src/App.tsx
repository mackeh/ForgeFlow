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
  clearToken,
  createAdminUser,
  createWebhook,
  createWorkflow,
  createWorkflowFromTemplate,
  createSchedule,
  deleteAdminUser,
  deleteSchedule,
  deleteWebhook,
  getDashboardMetrics,
  getAdminUsers,
  getCurrentUser,
  deleteWorkflow,
  getRoles,
  getRun,
  getRunDiff,
  getSchedules,
  getSecrets,
  getSystemTime,
  getTemplates,
  getWebhookEvents,
  getWebhooks,
  getWorkflowRuns,
  getWorkflowVersions,
  getWorkflows,
  login,
  publishWorkflow,
  rollbackWorkflow,
  runScheduleNow,
  runPreflight,
  saveSecret,
  startDesktopRecorder,
  startRecorder,
  startRun,
  stopDesktopRecorder,
  testWebhook,
  updateAdminUser,
  updateRole,
  updateWebhook,
  updateSchedule,
  updateWorkflow
} from "./api";
import { ActionNode } from "./components/ActionNode";
import { Sidebar } from "./components/Sidebar";
import { Inspector } from "./components/Inspector";

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

const defaultDefinition = {
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

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [workflowList, setWorkflowList] = useState<any[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<any | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultDefinition.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultDefinition.edges as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [status, setStatus] = useState<string>("");
  const [desktopRecording, setDesktopRecording] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [runDiff, setRunDiff] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [rollbackVersion, setRollbackVersion] = useState<number | "">("");
  const [secrets, setSecrets] = useState<any[]>([]);
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateWorkflowName, setTemplateWorkflowName] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleName, setScheduleName] = useState("Daily Run");
  const [scheduleCron, setScheduleCron] = useState("0 9 * * *");
  const [scheduleTimezone, setScheduleTimezone] = useState("");
  const [scheduleTestMode, setScheduleTestMode] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [dashboardDays, setDashboardDays] = useState(7);
  const [systemTime, setSystemTime] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
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

  const nodesRef = useRef<Node[]>(nodes);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(1);
  const logIdRef = useRef(1);

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
      { label: "Web Navigate", type: "playwright_navigate" },
      { label: "Web Click", type: "playwright_click" },
      { label: "Web Fill", type: "playwright_fill" },
      { label: "Web Extract", type: "playwright_extract" },
      { label: "Desktop Click", type: "desktop_click" },
      { label: "Desktop Click Image", type: "desktop_click_image" },
      { label: "Desktop Type", type: "desktop_type" },
      { label: "Desktop Wait Image", type: "desktop_wait_for_image" }
    ],
    []
  );

  useEffect(() => {
    if (!token) return;
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
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
    setWorkflowName(activeWorkflow?.name || "");
  }, [activeWorkflow?.id, activeWorkflow?.name]);

  useEffect(() => {
    if (!activeRun?.id) return;
    if (!["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(activeRun.status)) return;

    const timer = setInterval(() => {
      loadRun(activeRun.id).catch(() => undefined);
    }, 2000);

    return () => clearInterval(timer);
  }, [activeRun?.id, activeRun?.status]);

  useEffect(() => {
    if (!token) return;
    refreshDashboard(dashboardDays).catch(showError);
  }, [dashboardDays, systemTime?.timezone, token]);

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
      return;
    }
    const list = await getSchedules(workflowId);
    setSchedules(list || []);
  }

  async function refreshDashboard(days = dashboardDays) {
    const value = await getDashboardMetrics(days, systemTime?.timezone);
    setDashboard(value);
  }

  async function refreshAdmin() {
    const [userList, roleList, hooks, events] = await Promise.all([
      getAdminUsers(),
      getRoles(),
      getWebhooks(),
      getWebhookEvents()
    ]);
    setAdminUsers(userList || []);
    setRoles(roleList || []);
    setWebhookList(hooks || []);
    setWebhookEvents(events || []);
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

  const selectWorkflow = async (workflow: any) => {
    setActiveWorkflow(workflow);
    const def = workflow.draftDefinition || workflow.definition || defaultDefinition;
    setNodes(def.nodes || defaultDefinition.nodes);
    setEdges(def.edges || []);
    await refreshWorkflowMeta(workflow.id);
  };

  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const result = await login(username, password);
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        throw new Error("Login failed: token was not stored");
      }
      const me = await getCurrentUser();
      setCurrentUser(me || result?.user || null);
      setToken(storedToken);
      setFeedback("Signed in", "success");
    } catch (err: any) {
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
    setActiveRun(null);
    setRunDiff(null);
    setVersions([]);
    setSecrets([]);
    setTemplates([]);
    setSchedules([]);
    setDashboard(null);
    setSystemTime(null);
    setCurrentUser(null);
    setAdminUsers([]);
    setRoles([]);
    setWebhookList([]);
    setWebhookEvents([]);
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
    const wf = latest.find((x: any) => x.id === activeWorkflow.id);
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

  const handleAddNode = (type: string, dataOverrides: Record<string, any> = {}): string => {
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

  const validateWorkflowDefinition = (definition: any) => {
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
      playwright_navigate: ["url"],
      playwright_click: ["selector"],
      playwright_fill: ["selector", "value"],
      playwright_extract: ["selector", "saveAs"],
      desktop_type: ["value"],
      desktop_click_image: ["imagePath"],
      desktop_wait_for_image: ["imagePath"]
    };

    allNodes.forEach((node: any) => {
      const nodeType = String(node?.data?.type || "");
      const fields = requiredNodeFields[nodeType] || [];
      fields.forEach((field) => {
        const value = node?.data?.[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          validationErrors.push(`Node "${node.data?.label || node.id}" is missing "${field}".`);
        }
      });
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

  const handleSaveSecret = async () => {
    if (!secretKey) return;
    await saveSecret(secretKey, secretValue);
    setSecretKey("");
    setSecretValue("");
    const list = await getSecrets();
    setSecrets(list);
    setFeedback("Secret saved", "success");
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

  const handleRenameWorkflow = async () => {
    if (!activeWorkflow || !workflowName.trim()) return;
    const updated = await updateWorkflow(activeWorkflow.id, { name: workflowName.trim() });
    setActiveWorkflow(updated);
    setWorkflowList((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    setFeedback("Workflow renamed", "success");
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
    await refreshWorkflows(true);
    setFeedback("Workflow deleted", "success");
    await refreshDashboard();
  };

  const handleCreateSchedule = async () => {
    if (!activeWorkflow) {
      setFeedback("Select a workflow first", "error");
      return;
    }
    const timezone = scheduleTimezone || systemTime?.timezone;
    const created = await createSchedule({
      workflowId: activeWorkflow.id,
      name: scheduleName.trim() || "Scheduled run",
      cron: scheduleCron.trim(),
      timezone,
      enabled: true,
      testMode: scheduleTestMode
    });
    setSchedules((prev) => [created, ...prev]);
    setFeedback("Schedule created", "success");
    await refreshDashboard();
  };

  const handleToggleSchedule = async (schedule: any) => {
    const updated = await updateSchedule(schedule.id, { enabled: !schedule.enabled });
    setSchedules((prev) => prev.map((row) => (row.id === schedule.id ? updated : row)));
    setFeedback(updated.enabled ? "Schedule enabled" : "Schedule disabled", "success");
    await refreshDashboard();
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteSchedule(scheduleId);
    setSchedules((prev) => prev.filter((row) => row.id !== scheduleId));
    setFeedback("Schedule deleted", "success");
    await refreshDashboard();
  };

  const handleRunScheduleNow = async (scheduleId: string) => {
    const result = await runScheduleNow(scheduleId);
    setFeedback(result.executed ? "Scheduled run queued" : "Schedule already running", "info");
    await refreshDashboard();
    if (activeWorkflow) {
      await refreshWorkflowMeta(activeWorkflow.id);
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

  const currentPermissions: string[] = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
  const isAdminUser = currentPermissions.includes("*");
  const canManageUsers = isAdminUser || currentPermissions.includes("users:manage");
  const canManageRoles = isAdminUser || currentPermissions.includes("roles:manage");
  const canManageWebhooks = isAdminUser || currentPermissions.includes("webhooks:manage");
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
            <button
              disabled={isActionLoading("login")}
              className={isActionLoading("login") ? "is-loading" : ""}
              onClick={() => {
                withActionLoading("login", async () => {
                  const username = (document.getElementById("username") as HTMLInputElement).value;
                  const password = (document.getElementById("password") as HTMLInputElement).value;
                  await handleLogin(username, password);
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
        onSelect={(wf: any) => {
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
        <h3>Templates</h3>
        <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
          <option value="">Select template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
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
        <h3>Schedules</h3>
        <input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="Schedule name" />
        <input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="Cron (local time)" />
        <input
          value={scheduleTimezone}
          onChange={(e) => setScheduleTimezone(e.target.value)}
          placeholder={systemTime?.timezone || "Timezone"}
        />
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
          <MiniMap />
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
            {activeRun?.artifacts?.length ? (
              <small>{activeRun.artifacts.length} failure artifacts captured in /artifacts</small>
            ) : null}
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

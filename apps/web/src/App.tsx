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
  createWorkflow,
  deleteWorkflow,
  getRun,
  getRunDiff,
  getSecrets,
  getWorkflowRuns,
  getWorkflowVersions,
  getWorkflows,
  login,
  publishWorkflow,
  rollbackWorkflow,
  runPreflight,
  saveSecret,
  startDesktopRecorder,
  startRecorder,
  startRun,
  stopDesktopRecorder,
  updateWorkflow
} from "./api";
import { ActionNode } from "./components/ActionNode";
import { Sidebar } from "./components/Sidebar";
import { Inspector } from "./components/Inspector";

const nodeTypes = { action: ActionNode };
type ToastLevel = "info" | "success" | "error";
type Toast = { id: number; message: string; level: ToastLevel };

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const nodesRef = useRef<Node[]>(nodes);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(1);

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
    refreshWorkflows().catch(showError);
    getSecrets()
      .then(setSecrets)
      .catch(showError);
  }, [token]);

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

  const pushToast = (message: string, level: ToastLevel = "info") => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, level }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const setFeedback = (message: string, level: ToastLevel = "info") => {
    setStatus(message);
    pushToast(message, level);
  };

  const showError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    setFeedback(message, "error");
  };

  async function refreshWorkflows(forceSelectFirst = false) {
    const data = await getWorkflows();
    setWorkflowList(data);
    if ((forceSelectFirst || !activeWorkflow) && data.length) {
      await selectWorkflow(data[0]);
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
      await login(username, password);
      setToken(localStorage.getItem("token"));
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
    setFeedback(testMode ? "Test run started" : "Run started", "success");
    await refreshWorkflowMeta(activeWorkflow.id);
    await loadRun(run.id);
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
    const newNode: Node = {
      id,
      type: "action",
      position: findNextNodePosition(nodesRef.current),
      data: { label: type.replace(/_/g, " "), type, ...dataOverrides }
    };
    nodesRef.current = [...nodesRef.current, newNode];
    setNodes((nds) => [...nds, newNode]);

    if (lastNode) {
      setEdges((eds) => [...eds, { id: `e-${lastNode.id}-${id}`, source: lastNode.id, target: id }]);
    }

    return id;
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
              onClick={() => {
                const username = (document.getElementById("username") as HTMLInputElement).value;
                const password = (document.getElementById("password") as HTMLInputElement).value;
                handleLogin(username, password);
              }}
            >
              Sign in
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
          handleCreateWorkflow().catch(showError);
        }}
      >
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
            <button onClick={() => handleStartRecorder().catch(showError)}>Record Web</button>
            <button
              onClick={() =>
                (desktopRecording ? handleDesktopRecordStop() : handleDesktopRecordStart()).catch(showError)
              }
            >
              {desktopRecording ? "Stop Desktop" : "Record Desktop"}
            </button>
            <button onClick={autoLayoutNodes}>Auto Layout</button>
            <button onClick={() => setSnapToGrid((value) => !value)}>{snapToGrid ? "Snap: On" : "Snap: Off"}</button>
            <button onClick={() => handleSave().catch(showError)}>Save Draft</button>
            <button onClick={() => handlePublish().catch(showError)}>Publish</button>
            <button onClick={() => runWorkflow(true).catch(showError)}>Test Run</button>
            <button className="primary" onClick={() => runWorkflow(false).catch(showError)}>
              Run
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
          </div>
        </div>

        <div className="status-bar">{status || "Ready"}</div>
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.level}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </div>

      <Inspector node={selectedNode} onUpdate={setNodes} />
    </div>
  );
}

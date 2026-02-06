import { useEffect, useMemo, useRef, useState } from "react";
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
  createWorkflow,
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

  const nodesRef = useRef<Node[]>(nodes);

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
    refreshWorkflows().catch((err) => setStatus(err.message));
    getSecrets()
      .then(setSecrets)
      .catch((err) => setStatus(err.message));
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

  async function refreshWorkflows() {
    const data = await getWorkflows();
    setWorkflowList(data);
    if (!activeWorkflow && data.length) {
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
    } catch (err: any) {
      setStatus(err.message);
    }
  };

  const handleCreateWorkflow = async () => {
    const name = `Workflow ${workflowList.length + 1}`;
    const created = await createWorkflow({ name, definition: defaultDefinition });
    setWorkflowList((list) => [created, ...list]);
    await selectWorkflow(created);
  };

  const handleSave = async () => {
    if (!activeWorkflow) return null;
    const definition = buildCurrentDefinition();
    const updated = await updateWorkflow(activeWorkflow.id, { definition, notes: "Saved from UI" });
    setActiveWorkflow(updated);
    setWorkflowList((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    setStatus("Draft saved");
    return updated;
  };

  const runWorkflow = async (testMode = false, resumeFromRunId?: string) => {
    if (!activeWorkflow) return;
    await handleSave();
    const preflight = await runPreflight({ definition: buildCurrentDefinition() });
    if (!preflight.ready) {
      const msg = preflight.messages?.join(" | ") || "Preflight failed";
      setStatus(`Preflight blocked run: ${msg}`);
      return;
    }
    const run = await startRun(activeWorkflow.id, { testMode, resumeFromRunId });
    setStatus(testMode ? "Test run started" : "Run started");
    await refreshWorkflowMeta(activeWorkflow.id);
    await loadRun(run.id);
  };

  const handlePublish = async () => {
    if (!activeWorkflow) return;
    await handleSave();
    await publishWorkflow(activeWorkflow.id, "Published from UI");
    setStatus("Published");
    await refreshWorkflowMeta(activeWorkflow.id);
    await refreshWorkflows();
  };

  const handleRollback = async () => {
    if (!activeWorkflow || rollbackVersion === "") return;
    await rollbackWorkflow(activeWorkflow.id, Number(rollbackVersion));
    setStatus(`Rolled back to version ${rollbackVersion}`);
    await refreshWorkflows();
    const latest = await getWorkflows();
    const wf = latest.find((x: any) => x.id === activeWorkflow.id);
    if (wf) await selectWorkflow(wf);
  };

  const handleAddNode = (type: string, dataOverrides: Record<string, any> = {}): string => {
    const id = `${type}-${Date.now()}`;
    const lastNode = nodesRef.current[nodesRef.current.length - 1];
    const newNode: Node = {
      id,
      type: "action",
      position: { x: 120 + nodesRef.current.length * 20, y: 120 + nodesRef.current.length * 40 },
      data: { label: type.replace(/_/g, " "), type, ...dataOverrides }
    };
    nodesRef.current = [...nodesRef.current, newNode];
    setNodes((nds) => [...nds, newNode]);

    if (lastNode) {
      setEdges((eds) => [...eds, { id: `e-${lastNode.id}-${id}`, source: lastNode.id, target: id }]);
    }

    return id;
  };

  const handleStartRecorder = async () => {
    setStatus("Starting recorder...");
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

    ws.onopen = () => setStatus("Recorder connected");
    ws.onerror = () => setStatus("Recorder error");
  };

  const handleDesktopRecordStart = async () => {
    setStatus("Starting desktop recorder...");
    await startDesktopRecorder("session");
    setDesktopRecording(true);
    setStatus("Desktop recording active");
  };

  const handleDesktopRecordStop = async () => {
    const result = await stopDesktopRecorder();
    setDesktopRecording(false);
    setStatus("Desktop recording stopped");
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
      setStatus("No waiting approval node found");
      return;
    }
    await approveRun(activeRun.id, nodeId, true);
    setStatus(`Approved node ${nodeId}`);
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
    setStatus("Secret saved");
  };

  const handleRenameWorkflow = async () => {
    if (!activeWorkflow || !workflowName.trim()) return;
    const updated = await updateWorkflow(activeWorkflow.id, { name: workflowName.trim() });
    setActiveWorkflow(updated);
    setWorkflowList((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    setStatus("Workflow renamed");
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
          selectWorkflow(wf).catch((err) => setStatus(err.message));
        }}
        onCreate={() => {
          handleCreateWorkflow().catch((err) => setStatus(err.message));
        }}
      >
        <h3>Workflow</h3>
        <input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="Workflow name" />
        <button onClick={() => handleRenameWorkflow().catch((err) => setStatus(err.message))}>Rename</button>
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
        <button onClick={() => handleRollback().catch((err) => setStatus(err.message))}>Rollback</button>
        <h3>Secrets</h3>
        <input placeholder="Secret key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
        <input
          placeholder="Secret value"
          type="password"
          value={secretValue}
          onChange={(e) => setSecretValue(e.target.value)}
        />
        <button onClick={() => handleSaveSecret().catch((err) => setStatus(err.message))}>Save Secret</button>
        <small>{secrets.length} stored secret keys</small>
      </Sidebar>

      <div className="canvas">
        <div className="toolbar">
          <div className="toolbar-left">
            {nodeOptions.map((opt) => (
              <button key={opt.type} onClick={() => handleAddNode(opt.type)}>
                + {opt.label}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <button onClick={() => handleStartRecorder().catch((err) => setStatus(err.message))}>Record Web</button>
            <button
              onClick={() =>
                (desktopRecording ? handleDesktopRecordStop() : handleDesktopRecordStart()).catch((err) =>
                  setStatus(err.message)
                )
              }
            >
              {desktopRecording ? "Stop Desktop" : "Record Desktop"}
            </button>
            <button onClick={() => handleSave().catch((err) => setStatus(err.message))}>Save Draft</button>
            <button onClick={() => handlePublish().catch((err) => setStatus(err.message))}>Publish</button>
            <button onClick={() => runWorkflow(true).catch((err) => setStatus(err.message))}>Test Run</button>
            <button className="primary" onClick={() => runWorkflow(false).catch((err) => setStatus(err.message))}>
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
                onClick={() => loadRun(run.id).catch((err) => setStatus(err.message))}
              >
                <div>{run.status}</div>
                <small>{new Date(run.createdAt).toLocaleString()}</small>
              </button>
            ))}
            {activeRun?.status === "FAILED" ? (
              <button onClick={() => runWorkflow(false, activeRun.id).catch((err) => setStatus(err.message))}>
                Resume From Failed Run
              </button>
            ) : null}
            {activeRun?.status === "WAITING_APPROVAL" ? (
              <button onClick={() => handleApprove().catch((err) => setStatus(err.message))}>Approve Waiting Node</button>
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
      </div>

      <Inspector node={selectedNode} onUpdate={setNodes} />
    </div>
  );
}

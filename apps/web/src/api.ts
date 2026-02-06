const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  } as Record<string, string>;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setToken(data.token);
  return data;
}

export function getWorkflows() {
  return request("/api/workflows");
}

export function createWorkflow(payload: { name: string; definition: any }) {
  return request("/api/workflows", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateWorkflow(id: string, payload: { name?: string; definition?: any }) {
  return request(`/api/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteWorkflow(id: string) {
  return request(`/api/workflows/${id}`, {
    method: "DELETE"
  });
}

export function publishWorkflow(id: string, notes?: string) {
  return request(`/api/workflows/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ notes })
  });
}

export function getWorkflowVersions(id: string) {
  return request(`/api/workflows/${id}/versions`);
}

export function rollbackWorkflow(id: string, version: number) {
  return request(`/api/workflows/${id}/rollback`, {
    method: "POST",
    body: JSON.stringify({ version })
  });
}

export function startRun(workflowId: string, options?: { testMode?: boolean; inputData?: any; resumeFromRunId?: string }) {
  return request("/api/runs/start", {
    method: "POST",
    body: JSON.stringify({ workflowId, ...(options || {}) })
  });
}

export function getWorkflowRuns(workflowId: string) {
  return request(`/api/workflows/${workflowId}/runs`);
}

export function getRun(runId: string) {
  return request(`/api/runs/${runId}`);
}

export function approveRun(runId: string, nodeId: string, approved = true) {
  return request(`/api/runs/${runId}/approve`, {
    method: "POST",
    body: JSON.stringify({ nodeId, approved })
  });
}

export function getRunDiff(runId: string) {
  return request(`/api/runs/${runId}/diff-last-success`);
}

export function runPreflight(payload: { workflowId?: string; definition?: any }) {
  return request("/api/system/preflight", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function startRecorder(startUrl?: string) {
  return request("/api/recorders/web/start", {
    method: "POST",
    body: JSON.stringify({ startUrl })
  });
}

export function startDesktopRecorder(label?: string) {
  return request("/api/recorders/desktop/start", {
    method: "POST",
    body: JSON.stringify({ label })
  });
}

export function stopDesktopRecorder() {
  return request("/api/recorders/desktop/stop", {
    method: "POST"
  });
}

export function getSecrets() {
  return request("/api/secrets");
}

export function saveSecret(key: string, value: string) {
  return request("/api/secrets", {
    method: "POST",
    body: JSON.stringify({ key, value })
  });
}

export { API_URL };

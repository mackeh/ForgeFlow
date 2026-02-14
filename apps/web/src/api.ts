import type {
  ActivityCatalog,
  AutopilotPlan,
  DocumentUnderstandingResult,
  MiningSummary,
  OrchestratorJob,
  OrchestratorOverview,
  OrchestratorRobot,
  WorkflowTemplateDetail,
  WorkflowTemplateSummary,
  WorkflowDefinition,
  WorkflowRecord,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WorkflowSummary,
  WorkflowVersion
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type RequestError = Error & {
  status?: number;
  path?: string;
  details?: unknown;
};

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isLogin = path === "/api/auth/login";
  if (path.startsWith("/api/") && !isLogin && !token) {
    clearToken();
    const missingTokenError = new Error("Missing token. Please sign in again.") as RequestError;
    missingTokenError.status = 401;
    missingTokenError.path = path;
    throw missingTokenError;
  }

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
    if (res.status === 401 && !isLogin) {
      clearToken();
    }
    const errPayload = await res.json().catch(() => ({ error: "Request failed" }));
    const message =
      res.status === 401 && !isLogin
        ? "Session expired or invalid. Please sign in again."
        : errPayload.error || `Request failed (${res.status})`;
    const requestError = new Error(message) as RequestError;
    requestError.status = res.status;
    requestError.path = path;
    requestError.details = errPayload;
    throw requestError;
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string, totpCode?: string) {
  const data = await request<{ token: string; user: { username: string; role: string; permissions: string[] } }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password, totpCode })
    }
  );
  setToken(data.token);
  return data;
}

export function getCurrentUser() {
  return request("/api/auth/me");
}

export function getTwoFactorStatus() {
  return request("/api/auth/2fa/status");
}

export function beginTwoFactorSetup() {
  return request("/api/auth/2fa/setup", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function verifyTwoFactorSetup(token: string) {
  return request("/api/auth/2fa/verify-setup", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export function disableTwoFactor(token: string) {
  return request("/api/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export function getWorkflows() {
  return request<WorkflowSummary[]>("/api/workflows");
}

export function getWorkflow(id: string) {
  return request<WorkflowRecord>(`/api/workflows/${id}`);
}

export function createWorkflow(payload: { name: string; definition: WorkflowDefinition }) {
  return request<WorkflowRecord>("/api/workflows", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getTemplates() {
  return request<WorkflowTemplateSummary[]>("/api/templates");
}

export function getTemplate(templateId: string) {
  return request<WorkflowTemplateDetail>(`/api/templates/${encodeURIComponent(templateId)}`);
}

export function getActivities() {
  return request<ActivityCatalog>("/api/activities");
}

export function generateAutopilotPlan(payload: { prompt: string; name?: string }) {
  return request<AutopilotPlan>("/api/autopilot/plan", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function understandDocument(payload: { text: string; expectedFields?: string[] }) {
  return request<DocumentUnderstandingResult>("/api/document/understand", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getOrchestratorOverview() {
  return request<OrchestratorOverview>("/api/orchestrator/overview");
}

export function getOrchestratorRobots() {
  return request<OrchestratorRobot[]>("/api/orchestrator/robots");
}

export function createOrchestratorRobot(payload: {
  name: string;
  mode?: "attended" | "unattended";
  enabled?: boolean;
  labels?: string[];
  maxConcurrentJobs?: number;
}) {
  return request<OrchestratorRobot>("/api/orchestrator/robots", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateOrchestratorRobot(
  id: string,
  payload: {
    name?: string;
    mode?: "attended" | "unattended";
    enabled?: boolean;
    labels?: string[];
    maxConcurrentJobs?: number;
    lastHeartbeatAt?: string;
  }
) {
  return request<OrchestratorRobot>(`/api/orchestrator/robots/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function getOrchestratorJobs(params?: { status?: string; workflowId?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.workflowId) q.set("workflowId", params.workflowId);
  const query = q.toString();
  return request<OrchestratorJob[]>(`/api/orchestrator/jobs${query ? `?${query}` : ""}`);
}

export function createOrchestratorJob(payload: {
  workflowId: string;
  mode?: "attended" | "unattended";
  robotId?: string;
  testMode?: boolean;
  inputData?: unknown;
}) {
  return request<OrchestratorJob>("/api/orchestrator/jobs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function dispatchOrchestratorJob(id: string) {
  return request<{ job: OrchestratorJob; run: WorkflowRunSummary }>(`/api/orchestrator/jobs/${id}/dispatch`, {
    method: "POST"
  });
}

export function syncOrchestratorJob(id: string) {
  return request<OrchestratorJob>(`/api/orchestrator/jobs/${id}/sync`, {
    method: "POST"
  });
}

export function getMiningSummary(days = 14) {
  const q = new URLSearchParams({ days: String(days) });
  return request<MiningSummary>(`/api/mining/summary?${q.toString()}`);
}

export function createWorkflowFromTemplate(payload: { templateId: string; name?: string; setupValues?: Record<string, unknown> }) {
  return request<WorkflowRecord>("/api/workflows/from-template", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateWorkflow(id: string, payload: { name?: string; definition?: WorkflowDefinition }) {
  return request<WorkflowRecord>(`/api/workflows/${id}`, {
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
  return request<WorkflowVersion[]>(`/api/workflows/${id}/versions`);
}

export function rollbackWorkflow(id: string, version: number) {
  return request(`/api/workflows/${id}/rollback`, {
    method: "POST",
    body: JSON.stringify({ version })
  });
}

export function startRun(
  workflowId: string,
  options?: { testMode?: boolean; inputData?: unknown; resumeFromRunId?: string }
) {
  return request<WorkflowRunSummary>("/api/runs/start", {
    method: "POST",
    body: JSON.stringify({ workflowId, ...(options || {}) })
  });
}

export function getWorkflowRuns(workflowId: string) {
  return request<WorkflowRunSummary[]>(`/api/workflows/${workflowId}/runs`);
}

export function getWorkflowPresence(workflowId: string) {
  return request(`/api/workflows/${workflowId}/collab/presence`);
}

export function getWorkflowComments(workflowId: string) {
  return request(`/api/workflows/${workflowId}/comments`);
}

export function createWorkflowComment(
  workflowId: string,
  payload: {
    message: string;
    nodeId?: string;
  }
) {
  return request(`/api/workflows/${workflowId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteWorkflowComment(workflowId: string, commentId: string) {
  return request(`/api/workflows/${workflowId}/comments/${commentId}`, {
    method: "DELETE"
  });
}

export function getWorkflowHistory(workflowId: string, limit = 80) {
  const q = new URLSearchParams({ limit: String(limit) });
  return request(`/api/workflows/${workflowId}/history?${q.toString()}`);
}

export function getIntegrations() {
  return request("/api/integrations");
}

export function createIntegration(payload: {
  name: string;
  type: "postgresql" | "mysql" | "mongodb" | "google_sheets" | "airtable" | "s3" | "http_api";
  config?: Record<string, unknown>;
}) {
  return request("/api/integrations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateIntegration(
  id: string,
  payload: {
    name?: string;
    type?: "postgresql" | "mysql" | "mongodb" | "google_sheets" | "airtable" | "s3" | "http_api";
    config?: Record<string, unknown>;
  }
) {
  return request(`/api/integrations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteIntegration(id: string) {
  return request(`/api/integrations/${id}`, {
    method: "DELETE"
  });
}

export function testIntegration(id: string) {
  return request(`/api/integrations/${id}/test`, {
    method: "POST"
  });
}

export function importCsv(payload: { text?: string; filePath?: string }) {
  return request("/api/integrations/import/csv", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getRun(runId: string) {
  return request<WorkflowRunDetail>(`/api/runs/${runId}`);
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

export function getSchedules(workflowId?: string) {
  const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : "";
  return request(`/api/schedules${query}`);
}

export function getSchedulePresets() {
  return request("/api/schedules/presets");
}

export function getUpcomingSchedules(params?: {
  workflowId?: string;
  days?: number;
  limit?: number;
  perSchedule?: number;
}) {
  const q = new URLSearchParams();
  if (params?.workflowId) q.set("workflowId", params.workflowId);
  if (params?.days !== undefined) q.set("days", String(params.days));
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.perSchedule !== undefined) q.set("perSchedule", String(params.perSchedule));
  const query = q.toString();
  return request(`/api/schedules/upcoming${query ? `?${query}` : ""}`);
}

export function previewSchedule(cron: string, timezone?: string) {
  const q = new URLSearchParams({ cron });
  if (timezone) q.set("timezone", timezone);
  return request(`/api/schedules/preview?${q.toString()}`);
}

export function createSchedule(payload: {
  workflowId: string;
  name?: string;
  cron: string;
  timezone?: string;
  enabled?: boolean;
  testMode?: boolean;
  dependsOnScheduleId?: string;
  maintenanceWindows?: Array<{ start: string; end: string; weekdays?: number[] }>;
  inputData?: unknown;
}) {
  return request("/api/schedules", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSchedule(id: string, payload: {
  name?: string;
  cron?: string;
  timezone?: string;
  enabled?: boolean;
  testMode?: boolean;
  dependsOnScheduleId?: string;
  maintenanceWindows?: Array<{ start: string; end: string; weekdays?: number[] }>;
  inputData?: unknown;
}) {
  return request(`/api/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteSchedule(id: string) {
  return request(`/api/schedules/${id}`, {
    method: "DELETE"
  });
}

export function runScheduleNow(id: string) {
  return request(`/api/schedules/${id}/run-now`, {
    method: "POST"
  });
}

export function getDashboardMetrics(days = 7, timezone?: string) {
  const q = new URLSearchParams({ days: String(days) });
  if (timezone) q.set("timezone", timezone);
  return request(`/api/metrics/dashboard?${q.toString()}`);
}

export function getSystemTime() {
  return request("/api/system/time");
}

export function getAdminUsers() {
  return request("/api/admin/users");
}

export function createAdminUser(payload: { username: string; password: string; role?: string; disabled?: boolean }) {
  return request("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminUser(
  username: string,
  payload: { role?: string; password?: string; disabled?: boolean }
) {
  return request(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAdminUser(username: string) {
  return request(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: "DELETE"
  });
}

export function getRoles() {
  return request("/api/admin/roles");
}

export function getAuditEvents(params?: {
  limit?: number;
  actorUsername?: string;
  action?: string;
  resourceType?: string;
  success?: boolean;
}) {
  const q = new URLSearchParams();
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.actorUsername) q.set("actorUsername", params.actorUsername);
  if (params?.action) q.set("action", params.action);
  if (params?.resourceType) q.set("resourceType", params.resourceType);
  if (params?.success !== undefined) q.set("success", String(params.success));
  const query = q.toString();
  return request(`/api/admin/audit${query ? `?${query}` : ""}`);
}

export function updateRole(role: string, permissions: string[]) {
  return request(`/api/admin/roles/${encodeURIComponent(role)}`, {
    method: "PUT",
    body: JSON.stringify({ permissions })
  });
}

export function getWebhooks() {
  return request("/api/webhooks");
}

export function getWebhookEvents() {
  return request("/api/webhooks/events");
}

export function createWebhook(payload: {
  name: string;
  url: string;
  events: string[];
  enabled?: boolean;
  secret?: string;
  headers?: Record<string, string>;
}) {
  return request("/api/webhooks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateWebhook(
  id: string,
  payload: {
    name?: string;
    url?: string;
    events?: string[];
    enabled?: boolean;
    secret?: string;
    headers?: Record<string, string>;
  }
) {
  return request(`/api/webhooks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteWebhook(id: string) {
  return request(`/api/webhooks/${id}`, {
    method: "DELETE"
  });
}

export function testWebhook(id: string) {
  return request(`/api/webhooks/${id}/test`, {
    method: "POST"
  });
}

export function runPreflight(payload: { workflowId?: string; definition?: any }) {
  return request<{ ready: boolean; checks: Record<string, unknown>; messages: string[] }>("/api/system/preflight", {
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

export function stopRecorder(sessionId: string) {
  return request<{ sessionId: string; events: Array<Record<string, unknown>> }>("/api/recorders/web/stop", {
    method: "POST",
    body: JSON.stringify({ sessionId })
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

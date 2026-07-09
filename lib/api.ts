export interface Execution {
  id: string;
  agent_id: string;
  agent_version?: string;
  input?: unknown;
  status: string;
  output?: unknown;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  deadline_at?: string;
}

export interface ExecutionPage {
  executions: Execution[];
  next_cursor?: string;
}

export interface Event {
  execution_id: string;
  event_seq: number;
  type: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
}

export interface Step {
  step_id: string;
  execution_id: string;
  kind: "tool_call" | "llm_call";
  target: string;
  args_hash: string;
  occurrence: number;
  status: string;
  idempotency: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  started_at?: string;
  completed_at?: string;
}

export interface Approval {
  id: string;
  step_id: string;
  execution_id: string;
  status: "pending" | "granted" | "denied" | "expired";
  approvers?: unknown;
  message?: string;
  timeout_at: string;
  decided_by?: string;
  decided_at?: string;
  rationale?: string;
  created_at: string;
}

// rebuno/internal/domain/agent.go has no `json:` tags, so Agent serializes
// with Go's default (PascalCase) field names — unlike every other type here.
export interface Agent {
  ID: string;
  WebhookURL: string;
  Secret: string;
  PolicyBundle: string;
  RegisteredAt: string;
}

async function request(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(path, opts);
  if (resp.status === 204) return undefined;
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message = (data && (data.message || data.error)) || resp.statusText;
    throw new Error(message);
  }
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    await request("GET", "/api/v0/health");
    return true;
  } catch {
    return false;
  }
}

export async function listExecutions(params?: {
  status?: string;
  agent_id?: string;
  cursor?: string;
  limit?: number;
}): Promise<ExecutionPage> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.agent_id) qs.set("agent_id", params.agent_id);
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString();
  const data = await request("GET", `/api/v0/executions${query ? `?${query}` : ""}`);
  return { executions: data?.executions ?? [], next_cursor: data?.next_cursor };
}

export async function createExecution(agentId: string, input: unknown, agentVersion?: string): Promise<Execution> {
  return request("POST", "/api/v0/executions", {
    agent_id: agentId,
    input,
    agent_version: agentVersion,
  });
}

export async function getExecution(id: string): Promise<Execution> {
  return request("GET", `/api/v0/executions/${encodeURIComponent(id)}`);
}

export async function cancelExecution(id: string): Promise<void> {
  await request("POST", `/api/v0/executions/${encodeURIComponent(id)}/cancel`);
}

export async function getEvents(executionId: string, afterSeq = 0, limit = 200): Promise<Event[]> {
  const qs = new URLSearchParams({ after_seq: String(afterSeq), limit: String(limit) });
  const data = await request("GET", `/api/v0/executions/${encodeURIComponent(executionId)}/events?${qs}`);
  return data ?? [];
}

export async function listSteps(executionId: string): Promise<Step[]> {
  const data = await request("GET", `/api/v0/executions/${encodeURIComponent(executionId)}/steps`);
  return data ?? [];
}

export async function getStep(executionId: string, stepId: string): Promise<Step> {
  return request(
    "GET",
    `/api/v0/executions/${encodeURIComponent(executionId)}/steps/${encodeURIComponent(stepId)}`
  );
}

export async function listPendingApprovals(): Promise<Approval[]> {
  const data = await request("GET", "/api/v0/approvals");
  return data ?? [];
}

export async function getApproval(id: string): Promise<Approval> {
  return request("GET", `/api/v0/approvals/${encodeURIComponent(id)}`);
}

export async function grantApproval(id: string, decidedBy: string, rationale?: string): Promise<void> {
  await request("POST", `/api/v0/approvals/${encodeURIComponent(id)}/grant`, { decided_by: decidedBy, rationale });
}

export async function denyApproval(id: string, decidedBy: string, rationale?: string): Promise<void> {
  await request("POST", `/api/v0/approvals/${encodeURIComponent(id)}/deny`, { decided_by: decidedBy, rationale });
}

export async function listAgents(): Promise<Agent[]> {
  const data = await request("GET", "/api/v0/agents");
  return data ?? [];
}

export async function registerAgent(id: string, webhookUrl: string, secret: string): Promise<Agent> {
  return request("POST", "/api/v0/agents", { id, webhook_url: webhookUrl, secret });
}

export async function deleteAgent(id: string): Promise<void> {
  await request("DELETE", `/api/v0/agents/${encodeURIComponent(id)}`);
}

export async function loadPolicy(agentId: string, bundle: string): Promise<void> {
  await request("POST", `/api/v0/policies/${encodeURIComponent(agentId)}`, { bundle });
}

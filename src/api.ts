import type {
  AppConfig,
  Conversation,
  ConversationSummary,
  CustomerMeResponse,
  CustomerOrder,
  CustomerSignInResponse,
  CustomerTicket,
  Decision,
  DecisionResponse,
  Order,
  OrderDetail,
  OrderListItem,
  RunDetail,
  Scenario,
  SendMessageResponse,
  StartRunResponse,
  TicketDetail,
  TicketListItem,
} from './types';

export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Human-readable message for any thrown value. API errors carry the backend `detail` text. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Unexpected error';
}

/** FastAPI `detail` may be a string, or a list of validation errors ({loc, msg}). */
export function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (d && typeof d === 'object' && 'msg' in d) {
        const loc = Array.isArray((d as { loc?: unknown }).loc) ? (d as { loc: unknown[] }).loc.slice(1).join('.') : '';
        const msg = String((d as { msg: unknown }).msg);
        return loc ? `${loc}: ${msg}` : msg;
      }
      return JSON.stringify(d);
    });
    return parts.join('; ') || null;
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError(`Cannot reach the Relay API at ${API_URL}. Is the backend running?`, 0);
  }
  const text = await resp.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!resp.ok) {
    throw new ApiError(extractDetail(body) ?? `Request failed: ${resp.status} ${resp.statusText}`.trim(), resp.status);
  }
  return body as T;
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) });

/** Customer routes use a bearer token. The token is a server-side session, not an identity claim. */
function customerRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

const customerPost = <T>(token: string, path: string, payload?: unknown) =>
  customerRequest<T>(token, path, {
    method: 'POST',
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

export const getConfig = () => request<AppConfig>('/api/config');
export const getScenarios = () => request<Scenario[]>('/api/scenarios');
export const injectScenario = (scenario: string, variant?: string) =>
  post<Order>('/api/scenarios/inject', variant ? { scenario, variant } : { scenario });

export const listOrders = () => request<OrderListItem[]>('/api/orders');
export const getOrder = (id: string) => request<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`);

export const startRun = (orderId: string, stepMode: boolean) =>
  post<StartRunResponse>(`/api/orders/${encodeURIComponent(orderId)}/runs`, { step_mode: stepMode });
export const getRun = (id: string) => request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`);
export const stepRun = (id: string) => post<RunDetail>(`/api/runs/${encodeURIComponent(id)}/step`);
export const resumeRun = (id: string) => post<{ accepted: boolean }>(`/api/runs/${encodeURIComponent(id)}/resume`);

export const decideApproval = (id: string, decision: Decision, decidedBy: string, note?: string) =>
  post<DecisionResponse>(`/api/approvals/${encodeURIComponent(id)}/decision`, {
    decision,
    decided_by: decidedBy,
    ...(note ? { note } : {}),
  });

// ---- operator support tickets ----
export const listTickets = (status?: string) =>
  request<TicketListItem[]>(`/api/tickets${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const getTicket = (id: string) => request<TicketDetail>(`/api/tickets/${encodeURIComponent(id)}`);
export const dispatchTicket = (id: string) =>
  post<{ ticket_id: string; job_id: string; queued: boolean }>(`/api/tickets/${encodeURIComponent(id)}/dispatch`);
export const updateTicketStatus = (
  ticketId: string,
  status?: string,
  simulateDaysOnHold?: number,
  assignedTo?: string,
  department?: string,
  resolutionNotes?: string,
) =>
  post<TicketDetail>(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    ...(status ? { status } : {}),
    ...(simulateDaysOnHold !== undefined ? { simulate_days_on_hold: simulateDaysOnHold } : {}),
    ...(assignedTo !== undefined ? { assigned_to: assignedTo } : {}),
    ...(department !== undefined ? { department } : {}),
    ...(resolutionNotes !== undefined ? { resolution_notes: resolutionNotes } : {}),
  });

// ---- admin session ----
export interface AdminSignInResponse {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const adminSignIn = (email: string, password: string) =>
  post<AdminSignInResponse>('/api/admin/session', { email, password });

// ---- customer support (simulated sign-in; server-side ownership checks) ----
export const customerSignIn = (email: string, password: string) =>
  post<CustomerSignInResponse>('/api/customer/session', { email, password });
export const registerCustomer = (name: string, email: string, userId: string, password: string) =>
  post<CustomerSignInResponse>('/api/customer/register', {
    name,
    email,
    user_id: userId.trim() ? userId.trim() : undefined,
    password,
  });
export const customerSignOut = (token: string) =>
  customerRequest<{ signed_out: boolean }>(token, '/api/customer/session', { method: 'DELETE' });
export const customerMe = (token: string) => customerRequest<CustomerMeResponse>(token, '/api/customer/me');
export const customerOrders = (token: string) => customerRequest<CustomerOrder[]>(token, '/api/customer/orders');
export const listConversations = (token: string) =>
  customerRequest<ConversationSummary[]>(token, '/api/customer/conversations');
export const createConversation = (token: string) =>
  customerPost<Conversation>(token, '/api/customer/conversations');
export const getConversation = (token: string, id: string) =>
  customerRequest<Conversation>(token, `/api/customer/conversations/${encodeURIComponent(id)}`);
export const sendChatMessage = (token: string, id: string, content: string) =>
  customerPost<SendMessageResponse>(token, `/api/customer/conversations/${encodeURIComponent(id)}/messages`, {
    content,
  });
export const listMyTickets = (token: string) => customerRequest<CustomerTicket[]>(token, '/api/customer/tickets');
export const getMyTicket = (token: string, id: string) =>
  customerRequest<CustomerTicket>(token, `/api/customer/tickets/${encodeURIComponent(id)}`);

/**
 * Fetch the trace through fetch + Blob (rather than an <a href>) so it also works
 * cross-origin, then trigger a browser download.
 */
export async function downloadTrace(runId: string): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/runs/${encodeURIComponent(runId)}/trace`);
  } catch {
    throw new ApiError(`Cannot reach the Relay API at ${API_URL}.`, 0);
  }
  if (!resp.ok) {
    let body: unknown = null;
    try {
      body = await resp.json();
    } catch {
      body = null;
    }
    throw new ApiError(extractDetail(body) ?? `Trace download failed: ${resp.status}`, resp.status);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relay-trace-${runId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

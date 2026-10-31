// Types mirroring the Relay backend:
// backend/relay/api/serializers.py, backend/relay/scenarios.py, backend/relay/config.py (Settings.public)
// and the simulator response models in backend/relay/clients/sim_client.py.

export type AgentMode = 'demo' | 'llm';

export interface SupportConfig {
  enabled: boolean;
  demo_customer_auth: boolean;
  rag_embedding_model: string | null;
  embedding_key_configured: boolean;
  vector_backend: 'chroma' | 'database' | string;
  llm_phrasing_enabled: boolean;
}

export interface AppConfig {
  mode: AgentMode;
  model: string | null;
  llm_key_configured: boolean;
  simulated_services: boolean;
  support?: SupportConfig;
  limits: {
    max_steps: number;
    max_tool_calls: number;
    max_active_seconds: number;
    tool_max_attempts: number;
  };
}

export interface ScenarioVariant {
  key: string;
  description: string;
}

export interface Scenario {
  key: string;
  title: string;
  description: string;
  default_variant: string;
  variants: ScenarioVariant[];
}

export type OrderStatus = 'pending' | 'paid' | 'reserved' | 'shipped' | 'refunded';

export interface Order {
  id: string;
  customer_email: string;
  sku: string;
  quantity: number;
  total_cents: number;
  currency: string;
  status: OrderStatus | string;
  payment_ref: string | null;
  reservation_id: string | null;
  shipment_id: string | null;
  refund_id: string | null;
  /** UNTRUSTED customer-provided text. Render as plain text only. */
  customer_note: string | null;
  /** UNTRUSTED workflow failure text. Render as plain text only. */
  workflow_error: string | null;
  scenario_label: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type RunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'succeeded'
  | 'escalated'
  | 'failed';

export type RunOutcome = 'fulfilled' | 'refunded' | 'escalated' | 'failed';

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ['pending', 'running', 'paused', 'awaiting_approval'];

export interface RunBrief {
  id: string;
  order_id: string;
  status: RunStatus;
  outcome: RunOutcome | string | null;
  mode: AgentMode;
  step_mode: boolean;
  created_at: string | null;
  finished_at: string | null;
}

export interface OrderListItem extends Order {
  latest_run: RunBrief | null;
  ticket_reasons: string[];
  pending_approval_id: string | null;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Approval {
  id: string;
  order_id: string;
  run_id: string | null;
  kind: string;
  amount_cents: number;
  currency: string;
  status: ApprovalStatus | string;
  reason: string;
  evidence: unknown;
  requested_at: string | null;
  expires_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export interface SupportTicket {
  id: string;
  order_id: string;
  customer_id?: string | null;
  conversation_id?: string | null;
  run_id: string | null;
  reason_code: string;
  category?: string | null;
  priority: string;
  summary: string;
  confirmed_summary?: string | null;
  citations?: Citation[] | null;
  evidence: unknown;
  service_evidence?: unknown;
  resolution_summary?: string | null;
  source?: string;
  status: string;
  created_at: string | null;
  updated_at?: string | null;
}

// ---- customer support / RAG ----

export type TicketStatus = 'new' | 'investigating' | 'recovering' | 'awaiting_approval' | 'resolved' | 'escalated';

export interface Citation {
  chunk_id: string;
  document_id: string;
  title: string;
  version: string;
  section: string;
  excerpt: string;
  score: number;
  retrieval: string;
}

export interface ChatMessage {
  id: number;
  role: 'customer' | 'assistant' | 'system' | string;
  content: string;
  citations: Citation[];
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PendingTicket {
  order_id: string;
  category: string;
  summary: string;
  citations: Citation[];
  requires_human?: boolean;
  policy_insufficient?: boolean;
  policy_conflicting?: boolean;
}

export interface TicketProgress {
  at: string;
  status: string;
  label: string;
}

export interface CustomerOrder {
  id: string;
  status: string;
  sku: string;
  quantity: number;
  total_cents: number;
  currency: string;
  created_at?: string;
}

export interface CustomerTicket {
  id: string;
  order_id: string;
  order: CustomerOrder | null;
  category: string;
  status: TicketStatus | string;
  summary: string;
  citations: Citation[];
  service_evidence: unknown;
  created_at: string;
  updated_at: string;
  resolution_summary: string | null;
  resolution: string | null;
  verified: boolean;
  run: { status: string; outcome: string | null } | null;
  conversation_id: string | null;
  progress: TicketProgress[];
}

export interface Conversation {
  id: string;
  status: string;
  stage: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  pending_ticket: PendingTicket | null;
  tickets: CustomerTicket[];
}

export interface ConversationSummary {
  id: string;
  updated_at: string;
  stage: string;
  last_message: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
}

export interface CustomerSignInResponse {
  token: string;
  expires_at: string;
  simulated: boolean;
  customer: Customer;
  orders: CustomerOrder[];
}

export interface CustomerMeResponse {
  customer: Customer;
  orders: CustomerOrder[];
  simulated_sign_in: boolean;
}

export interface SendMessageResponse {
  conversation: Conversation;
  message: ChatMessage | null;
  ticket: CustomerTicket | null;
  error?: string;
}

// ---- operator ticket queue ----

export interface TicketListItem {
  ticket: SupportTicket;
  customer: Customer | null;
  order: Order | null;
  run: RunBrief | null;
  pending_approval_id: string | null;
  verified: boolean;
  department?: string;
  assigned_to?: string;
  query?: string;
  raised_at?: string | null;
  resolved_at?: string | null;
  operator_status?: string | null;
  resolution_notes?: string | null;
}

export interface TicketConversation {
  id: string;
  created_at: string;
  messages: ChatMessage[];
}

export interface TicketDetail {
  ticket: SupportTicket;
  customer: Customer | null;
  order: Order | null;
  conversation: TicketConversation | null;
  run: RunDetail | null;
  approvals: Approval[];
  verification: Verification | null;
  pending_approval_id: string | null;
  verified: boolean;
  department?: string;
  assigned_to?: string;
  query?: string;
  raised_at?: string | null;
  resolved_at?: string | null;
  operator_status?: string | null;
  resolution_notes?: string | null;
}

// ---- live simulated service state (GET /api/orders/{id} -> services) ----

export interface ServiceError {
  error: string;
  message: string;
}

export interface PaymentRecord {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  memo: string | null;
}

export interface PaymentEventRecord {
  payment_id: string | null;
  type: string;
  amount_cents: number;
  source: string;
  memo: string | null;
}

export interface RefundRecord {
  id: string;
  payment_id: string;
  amount_cents: number;
  replayed: boolean;
}

export interface PaymentsState {
  order_id: string;
  payments: PaymentRecord[];
  events: PaymentEventRecord[];
  refunds: RefundRecord[];
}

export interface StockState {
  sku: string;
  available: number;
  reserved: number;
}

export interface ReservationRecord {
  id: string;
  order_id: string;
  sku: string;
  quantity: number;
  status: string;
  replayed: boolean;
}

export interface ReservationsState {
  order_id: string;
  reservations: ReservationRecord[];
}

export interface ShipmentRecord {
  id: string;
  order_id: string;
  status: string;
  carrier: string;
  tracking: string;
  replayed: boolean;
}

export interface ShipmentsState {
  order_id: string;
  shipments: ShipmentRecord[];
}

export interface Services {
  simulated: boolean;
  payment: PaymentsState | ServiceError;
  inventory: ReservationsState | ServiceError;
  stock: StockState | ServiceError;
  shipment: ShipmentsState | ServiceError;
}

export interface OrderDetail {
  order: Order;
  runs: RunBrief[];
  approvals: Approval[];
  tickets: SupportTicket[];
  services: Services;
}

// ---- run detail ----

export type ProposalSource = 'rules' | 'llm' | 'policy';

export interface Proposal {
  action: 'tool' | 'finish' | 'wait_for_approval' | string;
  tool: string | null;
  args?: Record<string, unknown>;
  summary: string;
  evidence_refs: string[];
  source: ProposalSource | string;
  rule_id: string | null;
}

export interface DecisionEntry {
  proposal: Proposal;
  allowed: boolean;
  rule_ids: string[];
  reasons: string[];
  canonical_args?: Record<string, unknown> | null;
}

export interface VerificationCheck {
  id: string;
  description: string;
  passed: boolean;
  detail: string | null;
}

export interface Verification {
  order_id?: string;
  expectation?: string;
  passed: boolean;
  checks: VerificationCheck[];
  error?: unknown;
}

export type ToolCallStatus = 'ok' | 'error' | 'ambiguous' | 'replayed';

export interface ToolCall {
  seq: number;
  node: string;
  tool: string;
  mutating: boolean;
  purpose: string | null;
  attempt: number;
  idempotency_key: string | null;
  status: ToolCallStatus | string;
  args: unknown;
  result: unknown;
  error: unknown;
  started_at: string | null;
  duration_ms: number | null;
}

export interface AuditEvent {
  id: number;
  ts: string | null;
  correlation_id: string | null;
  actor: string;
  event_type: string;
  payload: unknown;
}

export interface LlmMetrics {
  calls: number;
  errors: number;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  estimated_cost_usd: number | null;
  usage_reported_by_provider: boolean;
}

export interface RunMetrics {
  active_ms: number;
  wall_ms: number;
  tool_calls: number;
  steps: number;
  llm: LlmMetrics | null;
}

export interface RunDetail extends RunBrief {
  correlation_id: string;
  summary: string | null;
  error: string | null;
  steps: number;
  next_node: string | null;
  mode_label: string;
  metrics: RunMetrics;
  decisions: DecisionEntry[];
  verification: Verification | null;
  evidence: Record<string, unknown>;
  tool_calls: ToolCall[];
  audit_events: AuditEvent[];
  approvals: Approval[];
  tickets: SupportTicket[];
  order: Order | null;
}

// ---- request/response helpers ----

export interface StartRunResponse {
  run: RunBrief;
  already_active: boolean;
}

export interface DecisionResponse {
  approval: Approval;
  applied: boolean;
  run_resumed: boolean;
}

export type Decision = 'approve' | 'reject';

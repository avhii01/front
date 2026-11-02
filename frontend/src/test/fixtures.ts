import type { Approval, OrderListItem } from '../types';

export function makeOrder(over: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ORD-ABC123',
    customer_email: 'customer-ord-abc123@example.test',
    sku: 'SKU-ABC123',
    quantity: 1,
    total_cents: 4999,
    currency: 'USD',
    status: 'pending',
    payment_ref: null,
    reservation_id: null,
    shipment_id: null,
    refund_id: null,
    customer_note: null,
    workflow_error: 'order.confirm_payment: callback timed out after 30000ms',
    scenario_label: 'payment_captured_pending/basic',
    created_at: '2026-01-01T10:00:00+00:00',
    updated_at: '2026-01-01T10:00:00+00:00',
    latest_run: null,
    ticket_reasons: [],
    pending_approval_id: null,
    ...over,
  };
}

export function makeApproval(over: Partial<Approval> = {}): Approval {
  return {
    id: 'APR-1',
    order_id: 'ORD-ABC123',
    run_id: 'RUN-1',
    kind: 'refund',
    amount_cents: 84900,
    currency: 'USD',
    status: 'pending',
    reason: 'Out of stock after payment; refund requires human approval',
    evidence: { payment_id: 'PAY-1' },
    requested_at: '2026-01-01T10:01:00+00:00',
    expires_at: '2026-01-01T11:01:00+00:00',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    ...over,
  };
}

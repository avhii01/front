import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { makeOrder } from './test/fixtures';
import type { RunDetail } from './types';

const order = makeOrder({ workflow_error: '<script>alert(1)</script>' });

const run: RunDetail = {
  id: 'RUN-1',
  order_id: order.id,
  status: 'succeeded',
  outcome: 'fulfilled',
  mode: 'demo',
  step_mode: false,
  created_at: '2026-01-01T10:00:00+00:00',
  finished_at: '2026-01-01T10:00:02+00:00',
  correlation_id: 'c1',
  summary: 'Order recovered and fulfilled. All 1 verification checks passed.',
  error: null,
  steps: 3,
  next_node: null,
  mode_label: 'Deterministic demo mode (rule-based planner - no LLM)',
  metrics: { active_ms: 900, wall_ms: 2000, tool_calls: 1, steps: 3, llm: null },
  decisions: [
    {
      proposal: { action: 'tool', tool: 'create_shipment', summary: 'Shipping failed transiently; retry.', evidence_refs: ['shipment'], source: 'rules', rule_id: 'R-SHIP-RETRY' },
      allowed: true,
      rule_ids: ['P-ALLOW'],
      reasons: [],
    },
  ],
  verification: { passed: true, checks: [{ id: 'shipment_exists', description: 'Shipment exists', passed: true, detail: 'one shipment' }] },
  evidence: {},
  tool_calls: [
    {
      seq: 1, node: 'act', tool: 'create_shipment', mutating: true, purpose: 'reconcile', attempt: 2, idempotency_key: 'ship:ORD-ABC123',
      status: 'ok', args: { order_id: order.id }, result: { id: 'SHP-1' }, error: null, started_at: '2026-01-01T10:00:01+00:00', duration_ms: 12,
    },
  ],
  audit_events: [],
  approvals: [],
  tickets: [],
  order,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

beforeEach(() => {
  window.sessionStorage.setItem('relay.admin.token', 'test_adm');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      if (path === '/api/config') return json({ mode: 'demo', model: null, llm_key_configured: false, simulated_services: true, limits: {} });
      if (path === '/api/scenarios')
        return json([{ key: 's1', title: 'Scenario One', description: 'Desc one', default_variant: 'basic', variants: [{ key: 'basic', description: 'Basic variant' }] }]);
      if (path === '/api/orders') return json([{ ...order, latest_run: run }]);
      if (path === `/api/orders/${order.id}`)
        return json({
          order,
          runs: [run],
          approvals: [],
          tickets: [],
          services: {
            simulated: true,
            payment: { order_id: order.id, payments: [], events: [], refunds: [] },
            inventory: { error: 'CONNECTION_FAILED', message: 'cannot reach simulated service' },
            stock: { sku: order.sku, available: 8, reserved: 0 },
            shipment: { order_id: order.id, shipments: [] },
          },
        });
      if (path === '/api/runs/RUN-1') return json(run);
      if (path === '/api/tickets') {
        return json([
          {
            ticket: {
              id: 'TCK-1001',
              order_id: order.id,
              customer_id: 'cus_1',
              conversation_id: 'conv_1',
              reason_code: 'SHIPPING_DELAY',
              category: 'SHIPPING_DELAY',
              priority: 'normal',
              summary: 'Shipment delayed',
              confirmed_summary: 'Customer waiting for delayed package',
              citations: [],
              evidence: null,
              service_evidence: {},
              resolution_summary: null,
              source: 'customer',
              status: 'investigating',
              created_at: '2026-01-01T10:00:00Z',
              updated_at: '2026-01-01T10:00:00Z',
            },
            customer: { id: 'cus_1', name: 'John Doe', email: 'john@example.com' },
            order,
            run: null,
            pending_approval_id: null,
            verified: false,
            department: 'Shipping & Logistics',
            assigned_to: 'Alice Smith',
            query: 'Package has not arrived yet',
            raised_at: '2026-01-01T10:00:00Z',
            resolved_at: null,
            operator_status: 'working',
          },
        ]);
      }
      if (path === '/api/tickets/TCK-1001') {
        return json({
          ticket: {
            id: 'TCK-1001',
            order_id: order.id,
            customer_id: 'cus_1',
            conversation_id: 'conv_1',
            reason_code: 'SHIPPING_DELAY',
            category: 'SHIPPING_DELAY',
            priority: 'normal',
            summary: 'Shipment delayed',
            confirmed_summary: 'Customer waiting for delayed package',
            citations: [],
            evidence: null,
            service_evidence: {},
            resolution_summary: null,
            source: 'customer',
            status: 'investigating',
            created_at: '2026-01-01T10:00:00Z',
            updated_at: '2026-01-01T10:00:00Z',
          },
          customer: { id: 'cus_1', name: 'John Doe', email: 'john@example.com' },
          order,
          conversation: {
            id: 'conv_1',
            created_at: '2026-01-01T10:00:00Z',
            messages: [
              { id: 1, role: 'customer', content: 'Where is my order?', citations: [], meta: {}, created_at: '2026-01-01T10:00:00Z' },
              { id: 2, role: 'assistant', content: 'Let me check on that for you.', citations: [], meta: {}, created_at: '2026-01-01T10:00:01Z' },
            ],
          },
          run: null,
          approvals: [],
          verification: {},
          pending_approval_id: null,
          verified: false,
          department: 'Shipping & Logistics',
          assigned_to: 'Alice Smith',
          query: 'Package has not arrived yet',
          raised_at: '2026-01-01T10:00:00Z',
          resolved_at: null,
          operator_status: 'working',
        });
      }
      return json({ detail: `unexpected ${path}` }, 404);
    }),
  );
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the mode badge, SIMULATED badge, and a selected order workspace', async () => {
    const { container } = render(<App />);
    const badge = await screen.findByRole('status', { name: /Agent mode/ });
    expect(badge.textContent).toBe('Deterministic demo mode (rule-based, no LLM)');
    expect(screen.getByText('SIMULATED services')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: /Order ORD-ABC123/ }));

    expect(await screen.findByText('Order recovered and fulfilled. All 1 verification checks passed.')).toBeTruthy();
    expect(screen.getByText('Order fulfilled')).toBeTruthy();
    expect(screen.getByText('✎ MUTATING')).toBeTruthy();
    expect(screen.getByText(/RECONCILE/)).toBeTruthy();
    expect(screen.getByText(/Retry · attempt 2/)).toBeTruthy();
    expect(screen.getByText(/Could not read service \(CONNECTION_FAILED\)/)).toBeTruthy();
    expect(screen.getByText('No LLM calls (demo mode).')).toBeTruthy();
    expect(screen.getByText(/not chain-of-thought/)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    await waitFor(() => expect(screen.getAllByText('<script>alert(1)</script>').length).toBeGreaterThan(0));
  });

  it('shows admin sign in when not authenticated and does not expose credentials on screen', async () => {
    window.sessionStorage.clear();
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Operator Dashboard · Admin Sign In/i })).toBeTruthy();
    expect(screen.getByLabelText(/Admin Email or ID/i)).toBeTruthy();
    expect(screen.getByLabelText(/Password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign in as Admin/i })).toBeTruthy();
    expect(screen.queryByText('admin@relay.test')).toBeNull();
    expect(screen.queryByText('admin-relay')).toBeNull();
  });

  it('switches to support tickets view, displays ticket in queue, and opens details workspace when clicked', async () => {
    render(<App />);
    const ticketsTab = await screen.findByRole('button', { name: /Support tickets/i });
    fireEvent.click(ticketsTab);

    // Sidebar ticket item should be rendered
    const ticketButton = await screen.findByTestId('ticket-item-TCK-1001');
    expect(ticketButton).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();

    // Clicking the ticket button selects it and displays full details in the workspace
    fireEvent.click(ticketButton);

    expect(await screen.findByRole('heading', { name: /Ticket Details · TCK-1001/i })).toBeTruthy();
    expect(screen.getByText("Who Raised the Ticket")).toBeTruthy();
    expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
    expect(screen.getByText("What's the Query")).toBeTruthy();
    expect(screen.getAllByText(/Package has not arrived yet/i).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Alice Smith")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save Assignee/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Assign to Me/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Working$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Hold$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resolve \(Permanent\)/i })).toBeTruthy();
  });
});

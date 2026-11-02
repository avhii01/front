import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketQueue } from './TicketQueue';
import { TicketWorkspace } from './TicketWorkspace';
import type { TicketDetail, TicketListItem } from '../types';

const citation = {
  chunk_id: 'refund-policy::02::eligibility',
  document_id: 'refund-policy',
  title: 'Refunds and Cancellations',
  version: '1.1',
  section: 'Eligibility',
  excerpt: 'A refund requires human approval when the order cannot be fulfilled.',
  score: 0.88,
  retrieval: 'lexical_fallback',
};

function detail(over: Partial<TicketDetail> = {}): TicketDetail {
  return {
    ticket: {
      id: 'TKT-1',
      order_id: 'ORD-CUST1',
      customer_id: 'cus_alice',
      conversation_id: 'CONV-1',
      run_id: 'RUN-1',
      reason_code: 'OUT_OF_STOCK',
      category: 'OUT_OF_STOCK',
      priority: 'normal',
      summary: 'Payment captured but stock ran out.',
      confirmed_summary: 'Payment captured but stock ran out. Refund may be needed.',
      citations: [citation],
      evidence: {},
      service_evidence: { stock: { available: 0 } },
      resolution_summary: 'Refund issued and verified.',
      source: 'customer',
      status: 'resolved',
      created_at: '2026-01-01T10:00:00+00:00',
      updated_at: '2026-01-01T10:05:00+00:00',
    },
    customer: { id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' },
    order: null,
    conversation: {
      id: 'CONV-1',
      created_at: '2026-01-01T10:00:00+00:00',
      messages: [
        {
          id: 1,
          role: 'customer',
          content: 'My order never shipped.',
          citations: [],
          meta: {},
          created_at: '2026-01-01T10:00:00+00:00',
        },
        {
          id: 2,
          role: 'assistant',
          content: 'I found the stock record and can create a ticket after confirmation.',
          citations: [citation],
          meta: { injection_flagged: false },
          created_at: '2026-01-01T10:00:10+00:00',
        },
      ],
    },
    run: null,
    approvals: [],
    verification: { passed: true, checks: [] },
    pending_approval_id: null,
    verified: true,
    ...over,
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('TicketQueue', () => {
  const item = (over: Partial<TicketListItem> = {}): TicketListItem =>
    ({
      ticket: detail().ticket,
      customer: { id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' },
      order: null,
      run: null,
      pending_approval_id: null,
      verified: false,
      ...over,
    }) as TicketListItem;

  it('shows the customer-safe category, customer and status', () => {
    const onSelect = vi.fn();
    render(
      <TicketQueue
        tickets={[item(), item({ ticket: { ...detail().ticket, id: 'TKT-2', status: 'awaiting_approval' }, pending_approval_id: 'APR-1' })]}
        loading={false}
        error={null}
        selectedId={null}
        onSelect={onSelect}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByText('Out of stock').length).toBe(2);
    expect(screen.getAllByText('Alice Demo').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /TKT-1/ }));
    expect(onSelect).toHaveBeenCalledWith('TKT-1');
    expect(screen.getByText('Approval pending')).toBeTruthy();
  });
});

describe('TicketWorkspace', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const path = String(input).replace(/^https?:\/\/[^/]+/, '');
        if (path === '/api/tickets/TKT-1') return json(detail());
        if (path === '/api/tickets/TKT-2')
          return json(detail({
            ticket: { ...detail().ticket, id: 'TKT-2', status: 'awaiting_approval', resolution_summary: null },
            pending_approval_id: 'APR-1',
            verified: false,
            verification: null,
          }));
        return json({ detail: `unexpected ${path}` }, 404);
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows verified resolution, citations and the customer conversation', async () => {
    render(<TicketWorkspace ticketId="TKT-1" onOpenOrder={vi.fn()} />);
    expect(await screen.findByText(/Verification passed against the live service records/)).toBeTruthy();
    expect(screen.getAllByText(/Refund issued and verified/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Resolution Notes/)).toBeTruthy();
    expect(screen.getAllByText('Refunds and Cancellations').length).toBeGreaterThan(0);
    expect(screen.getByText('My order never shipped.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Dispatch recovery job|Re-dispatch recovery/ })).toBeNull();
    expect(screen.queryByText(/tool_calls/)).toBeNull();
  });

  it('surfaces a pending human approval and links it to the order workspace', async () => {
    const onOpenOrder = vi.fn();
    render(<TicketWorkspace ticketId="TKT-2" onOpenOrder={onOpenOrder} />);
    expect(await screen.findByText('Human approval pending')).toBeTruthy();
    expect(screen.getByText(/A human decision is required/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dispatch recovery job' })).toBeTruthy();
    expect(screen.queryByText(/Verification passed/)).toBeNull();
  });
});

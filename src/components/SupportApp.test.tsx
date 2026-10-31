import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SupportApp from './SupportApp';
import type { ChatMessage, Citation, Conversation, CustomerTicket } from '../types';

const citation: Citation = {
  chunk_id: 'payment-confirmation::01::awaiting-capture',
  document_id: 'payment-confirmation',
  title: 'Payment Confirmation Policy',
  version: '1.2',
  section: 'When payment is captured but the order is pending',
  excerpt: 'If the payment is captured and the order is still pending, Relay verifies the payment before retrying.',
  score: 0.91,
  retrieval: 'lexical_fallback',
};

function message(id: number, role: string, content: string, citations: Citation[] = [], meta: Record<string, unknown> = {}): ChatMessage {
  return {
    id,
    role,
    content,
    citations,
    meta: role === 'assistant' ? { engine: 'extractive_grounded', retrieval_label: 'Lexical fallback', ...meta } : meta,
    created_at: '2026-01-01T10:00:00+00:00',
  };
}

const order = {
  id: 'ORD-CUST1',
  status: 'pending',
  sku: 'SKU-1',
  quantity: 1,
  total_cents: 4999,
  currency: 'USD',
};

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'CONV-1',
    status: 'open',
    stage: 'awaiting_order',
    order_id: null,
    created_at: '2026-01-01T10:00:00+00:00',
    updated_at: '2026-01-01T10:00:00+00:00',
    messages: [message(1, 'assistant', 'Hello, how can I help with your order today?')],
    pending_ticket: null,
    tickets: [],
    ...over,
  };
}

function customerTicket(over: Partial<CustomerTicket> = {}): CustomerTicket {
  return {
    id: 'TKT-1',
    order_id: order.id,
    order,
    category: 'PAYMENT_PENDING',
    status: 'resolved',
    summary: 'Payment captured but the order was still pending.',
    citations: [citation],
    service_evidence: { payment: 'captured' },
    created_at: '2026-01-01T10:01:00+00:00',
    updated_at: '2026-01-01T10:02:00+00:00',
    resolution_summary: 'Payment verified and the order was released for fulfilment.',
    resolution: 'fulfilled',
    verified: true,
    run: { status: 'succeeded', outcome: 'fulfilled' },
    conversation_id: 'CONV-1',
    progress: [
      { at: '2026-01-01T10:01:30+00:00', status: 'investigating', label: 'Investigating live service records' },
      { at: '2026-01-01T10:02:00+00:00', status: 'resolved', label: 'Verified resolution' },
    ],
    ...over,
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function urlPath(input: RequestInfo | URL): string {
  return String(input).replace(/^https?:\/\/[^/]+/, '');
}

describe('SupportApp', () => {
  let current: Conversation;
  let tickets: CustomerTicket[];

  beforeEach(() => {
    window.sessionStorage.clear();
    current = conversation();
    tickets = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path = urlPath(input);
        const method = init?.method ?? 'GET';
        if (path === '/api/config') {
          return json({
            mode: 'demo',
            model: null,
            llm_key_configured: false,
            simulated_services: true,
            support: {
              enabled: true,
              demo_customer_auth: true,
              rag_embedding_model: null,
              embedding_key_configured: false,
              vector_backend: 'database',
              llm_phrasing_enabled: false,
            },
            limits: { max_steps: 20, max_tool_calls: 20, max_active_seconds: 120, tool_max_attempts: 3 },
          });
        }
        if (path === '/api/customer/session' && method === 'POST') {
          return json({
            token: 'tok-demo',
            expires_at: '2026-01-01T12:00:00+00:00',
            simulated: true,
            customer: { id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' },
            orders: [order],
          });
        }
        if (path === '/api/customer/me') {
          return json({
            customer: { id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' },
            orders: [order],
            simulated_sign_in: true,
          });
        }
        if (path === '/api/customer/conversations' && method === 'GET') {
          return json([
            {
              id: 'CONV-1',
              updated_at: '2026-01-01T10:00:00+00:00',
              stage: current.stage,
              last_message: current.messages[current.messages.length - 1]?.content ?? '',
            },
          ]);
        }
        if (path === '/api/customer/conversations' && method === 'POST') {
          return json(current);
        }
        if (path === '/api/customer/conversations/CONV-1') return json(current);
        if (path === '/api/customer/conversations/CONV-1/messages' && method === 'POST') {
          const body = JSON.parse(String(init?.body)) as { content: string };
          if (body.content === 'confirm') {
            const ticket = customerTicket({ status: 'investigating', verified: false, resolution_summary: null, resolution: null });
            tickets = [ticket];
            current = conversation({
              stage: 'ticket_created',
              order_id: order.id,
              messages: [
                ...current.messages,
                message(4, 'customer', 'confirm'),
                message(5, 'assistant', 'Ticket TKT-1 was created. Relay is checking the live service records now.'),
              ],
              tickets: [ticket],
            });
          } else {
            current = conversation({
              stage: 'awaiting_confirmation',
              order_id: order.id,
              messages: [
                ...current.messages,
                message(2, 'customer', body.content),
                message(3, 'assistant', 'I found the payment and can create a ticket after you confirm the summary.', [citation]),
              ],
              pending_ticket: {
                order_id: order.id,
                category: 'PAYMENT_PENDING',
                summary: 'Payment captured but the order was still pending.',
                citations: [citation],
              },
            });
          }
          return json({ conversation: current, message: current.messages[current.messages.length - 1], ticket: null });
        }
        if (path === '/api/customer/tickets') return json(tickets);
        return json({ detail: `unexpected ${method} ${path}` }, 404);
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('signs in through the simulated customer session, chats, and receives response', async () => {
    render(<SupportApp />);
    expect(await screen.findByRole('heading', { name: 'Sign in to the demo store' })).toBeTruthy();
    expect(screen.queryByText('Demo accounts')).toBeNull();
    expect(screen.queryByText('demo-alice')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Support chat' })).toBeTruthy();
    expect(screen.getByText(/signed in as Alice Demo/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your orders' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh orders' })).toBeNull();

    const composer = await screen.findByLabelText('Message to support');
    expect((composer as HTMLTextAreaElement).disabled).toBe(false);
    const text = 'My payment was deducted but order ORD-CUST1 is pending.';
    await waitFor(() => {
      const textarea = screen.getByLabelText('Message to support');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.change(textarea, { target: { value: text } });
      expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect((screen.getByLabelText('Message to support') as HTMLTextAreaElement).value).toBe(text);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('I found the payment and can create a ticket after you confirm the summary.')).toBeTruthy();
  });

  it('offers guided replies and sends the chosen label', async () => {
    window.sessionStorage.setItem('relay.customer.token', 'tok-demo');
    window.sessionStorage.setItem(
      'relay.customer',
      JSON.stringify({ id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' }),
    );
    current = conversation({
      stage: 'idle',
      messages: [
        message(1, 'assistant', 'Hi Alice. How can I help you today?', [], {
          engine: 'scripted',
          intent: 'greeting',
          options: [
            { label: 'Raise a support ticket', value: 'raise_ticket' },
            { label: 'Track an order', value: 'track_order' },
          ],
        }),
      ],
    });

    render(<SupportApp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Raise a support ticket' }));

    await waitFor(() => {
      const calls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => urlPath(input) === '/api/customer/conversations/CONV-1/messages');
      expect(calls).toHaveLength(1);
      const [, init] = calls[0]!;
      expect(JSON.parse(String(init?.body))).toMatchObject({ content: 'Raise a support ticket' });
    });
  });

  it('shows a verified resolved ticket message in the chat log', async () => {
    window.sessionStorage.setItem('relay.customer.token', 'tok-demo');
    window.sessionStorage.setItem(
      'relay.customer',
      JSON.stringify({ id: 'cus_alice', name: 'Alice Demo', email: 'alice@example.test' }),
    );
    tickets = [customerTicket()];
    current = conversation({
      stage: 'ticket_created',
      order_id: order.id,
      messages: [message(1, 'assistant', 'Your ticket is resolved.', [citation])],
      tickets,
    });

    render(<SupportApp />);
    expect(await screen.findByText('Your ticket is resolved.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your tickets' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Conversations' })).toBeNull();
  });
});

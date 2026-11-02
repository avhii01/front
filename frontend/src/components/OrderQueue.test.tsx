import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../test/fixtures';
import { OrderQueue } from './OrderQueue';

const noop = () => undefined;

describe('OrderQueue', () => {
  it('renders untrusted workflow_error as plain text, never HTML', () => {
    const evil = '<img src=x onerror="alert(1)"><b>pwned</b>';
    const { container } = render(
      <OrderQueue orders={[makeOrder({ workflow_error: evil })]} loading={false} error={null} selectedId={null} onSelect={noop} onRetry={noop} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(evil)).toBeTruthy();
  });

  it('shows run state, approval indicator and ticket reasons, and is selectable', () => {
    const onSelect = vi.fn();
    const order = makeOrder({
      pending_approval_id: 'APR-1',
      ticket_reasons: ['AMBIGUOUS_PAYMENT'],
      latest_run: {
        id: 'RUN-1',
        order_id: 'ORD-ABC123',
        status: 'awaiting_approval',
        outcome: null,
        mode: 'demo',
        step_mode: false,
        created_at: null,
        finished_at: null,
      },
    });
    render(<OrderQueue orders={[order]} loading={false} error={null} selectedId="ORD-ABC123" onSelect={onSelect} onRetry={noop} />);
    expect(screen.getByText(/Approval pending/)).toBeTruthy();
    expect(screen.getByText(/AMBIGUOUS_PAYMENT/)).toBeTruthy();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Order ORD-ABC123/ }));
    expect(onSelect).toHaveBeenCalledWith('ORD-ABC123');
  });

  it('has loading, empty and error states with retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<OrderQueue orders={null} loading error={null} selectedId={null} onSelect={noop} onRetry={onRetry} />);
    expect(screen.getByRole('status', { name: 'Loading orders' })).toBeTruthy();

    rerender(<OrderQueue orders={[]} loading={false} error={null} selectedId={null} onSelect={noop} onRetry={onRetry} />);
    expect(screen.getByText('No orders yet')).toBeTruthy();

    rerender(<OrderQueue orders={null} loading={false} error="Cannot reach the Relay API" selectedId={null} onSelect={noop} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Cannot reach the Relay API');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

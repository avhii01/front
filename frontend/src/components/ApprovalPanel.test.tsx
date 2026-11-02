import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import { makeApproval } from '../test/fixtures';
import type { DecisionResponse } from '../types';
import { ApprovalPanel, OPERATOR_STORAGE_KEY } from './ApprovalPanel';

const okResponse = (status: string): DecisionResponse => ({
  approval: makeApproval({ status, decided_by: 'Alex' }),
  applied: true,
  run_resumed: true,
});

describe('ApprovalPanel', () => {
  it('requires an operator name before deciding', () => {
    const onDecide = vi.fn();
    render(<ApprovalPanel approvals={[makeApproval()]} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/operator name/i);
    // amount is formatted from integer cents
    expect(screen.getByText(/\$849\.00/)).toBeTruthy();
  });

  it('submits the decision with the stored operator name', async () => {
    window.localStorage.setItem(OPERATOR_STORAGE_KEY, 'Alex');
    const onDecide = vi.fn().mockResolvedValue(okResponse('approved'));
    render(<ApprovalPanel approvals={[makeApproval()]} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('APR-1', 'reject', 'Alex', undefined));
  });

  it('shows the API error message on 409/422', async () => {
    window.localStorage.setItem(OPERATOR_STORAGE_KEY, 'Alex');
    const onDecide = vi.fn().mockRejectedValue(new ApiError('approval already decided', 409));
    render(<ApprovalPanel approvals={[makeApproval()]} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('approval already decided'));
  });

  it('shows decided state with the operator name', () => {
    render(<ApprovalPanel approvals={[makeApproval({ status: 'approved', decided_by: 'Alex', decided_at: '2026-01-01T10:05:00+00:00' })]} onDecide={vi.fn()} />);
    expect(screen.getByText(/Approved by Alex/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});

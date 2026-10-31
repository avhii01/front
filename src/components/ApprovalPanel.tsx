import { useState } from 'react';
import { errorMessage } from '../api';
import { formatDateTime, formatMoney, humanize } from '../format';
import { useLocalStorage } from '../hooks';
import type { Approval, Decision, DecisionResponse } from '../types';
import { JsonBlock } from './JsonBlock';
import { InlineError } from './States';

export const OPERATOR_STORAGE_KEY = 'relay.operatorName';

interface Props {
  approvals: Approval[];
  runStatus?: string;
  onDecide: (approvalId: string, decision: Decision, decidedBy: string, note?: string) => Promise<DecisionResponse>;
}

export function ApprovalPanel({ approvals, runStatus, onDecide }: Props) {
  const [operator, setOperator] = useLocalStorage(OPERATOR_STORAGE_KEY, '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');

  async function decide(approval: Approval, decision: Decision) {
    const name = operator.trim();
    setInfo(null);
    if (!name) {
      setError('Enter your operator name before deciding. Decisions are recorded against a named person.');
      return;
    }
    setError(null);
    setBusy(decision);
    try {
      const res = await onDecide(approval.id, decision, name, note.trim() || undefined);
      setNote('');
      setInfo(
        !res.applied
          ? 'The decision was not applied (the approval may already have been decided).'
          : res.run_resumed
            ? `Approval ${res.approval.status}. The run has resumed.`
            : `Approval ${res.approval.status}.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel panel--approval" aria-labelledby="approval-title">
      <h2 id="approval-title" className="panel__title">
        Human approval
      </h2>
      <p className="muted small">
        Refunds need a human decision. <strong>Only a person can approve or reject</strong>; the agent can request an approval but cannot decide
        it, and nothing here is executed until a human approves.
      </p>

      {approvals.length === 0 && (
        <p className="muted">
          {runStatus === 'awaiting_approval' ? 'Waiting for the approval request to load…' : 'No approval has been requested for this order.'}
        </p>
      )}

      {pending.length > 0 && (
        <div className="approval-form">
          <label className="field">
            <span className="field__label">Operator name (required)</span>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Alex Kim"
              aria-required="true"
              aria-invalid={error !== null && !operator.trim()}
            />
          </label>
          <label className="field">
            <span className="field__label">Note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Reason for your decision" />
          </label>
        </div>
      )}

      {pending.map((a) => (
        <article key={a.id} className="approval approval--pending" aria-label={`Pending approval ${a.id}`}>
          <div className="approval__head">
            <span className="badge badge--attention">⏳ Pending</span>
            <strong>
              {humanize(a.kind)} of {formatMoney(a.amount_cents, a.currency)}
            </strong>
          </div>
          <p className="approval__reason">{a.reason}</p>
          <p className="muted small">
            Requested {formatDateTime(a.requested_at)} · <strong>expires {formatDateTime(a.expires_at)}</strong>
          </p>
          <JsonBlock label="Evidence" value={a.evidence} />
          <div className="controls">
            <button type="button" className="btn btn--approve" disabled={busy !== null} onClick={() => void decide(a, 'approve')}>
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button type="button" className="btn btn--reject" disabled={busy !== null} onClick={() => void decide(a, 'reject')}>
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </article>
      ))}

      {error && <InlineError message={error} />}
      {info && (
        <p className="notice" role="status">
          {info}
        </p>
      )}

      {decided.map((a) => (
        <article key={a.id} className={`approval approval--${a.status}`} aria-label={`Approval ${a.id} ${a.status}`}>
          <div className="approval__head">
            <span className={`badge ${a.status === 'approved' ? 'badge--allowed' : a.status === 'rejected' ? 'badge--denied' : ''}`}>
              {a.status === 'approved' ? '✓' : a.status === 'rejected' ? '✗' : '⌛'} {humanize(a.status)}
              {a.decided_by ? ` by ${a.decided_by}` : ''}
            </span>
            <strong>
              {humanize(a.kind)} of {formatMoney(a.amount_cents, a.currency)}
            </strong>
          </div>
          <p className="approval__reason">{a.reason}</p>
          <p className="muted small">
            {a.decided_at ? `Decided ${formatDateTime(a.decided_at)}` : `Expired ${formatDateTime(a.expires_at)}`}
            {a.decision_note ? ` · note: ${a.decision_note}` : ''}
          </p>
        </article>
      ))}
    </section>
  );
}

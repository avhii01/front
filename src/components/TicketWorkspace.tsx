import { useEffect, useState } from 'react';
import { dispatchTicket, errorMessage, getTicket, updateTicketStatus } from '../api';
import { formatDateTime, formatMoney, humanize } from '../format';
import { usePolling } from '../hooks';
import { getSupportTeam, logTeamActivity, type SupportMember } from '../team';
import type { TicketDetail } from '../types';
import { PolicyCitations } from './PolicyCitations';
import { ErrorState, InlineError, Skeleton } from './States';
import { StatusChip, getOperationalTicketStatus } from './StatusChip';

interface Props {
  ticketId: string;
  onOpenOrder: (orderId: string) => void;
  onBack?: () => void;
  currentUser?: { id: string; name: string; email: string; role: string };
}

const DEPARTMENTS = [
  { value: 'Shipping & Logistics', label: '🚚 Shipping & Logistics' },
  { value: 'Payments & Billing', label: '💳 Payments & Billing' },
  { value: 'Inventory & Warehouse', label: '📦 Inventory & Warehouse' },
  { value: 'Customer Support Operations', label: '🎧 Customer Support Operations' },
];

const STATUS_OPTIONS = [
  { value: 'awaiting', label: '⏳ New Ticket' },
  { value: 'working', label: '⚙️ Working' },
  { value: 'on_hold', label: '⏸️ Hold' },
  { value: 'awaiting_caller', label: '📞 Waiting for caller confirmation' },
  { value: 'resolved', label: '✅ Resolved (Permanent)' },
  { value: 'escalated', label: '⚠️ Escalated' },
];

const STEPPER_STAGES = [
  { value: 'awaiting', stepNumber: 1, label: 'New Ticket', icon: '⏳', desc: 'Queued for review' },
  { value: 'working', stepNumber: 2, label: 'Working', icon: '⚙️', desc: 'Specialist investigating' },
  { value: 'on_hold', stepNumber: 3, label: 'Hold', icon: '⏸️', desc: 'Pending internal action' },
  { value: 'awaiting_caller', stepNumber: 4, label: 'Waiting for Caller', icon: '📞', desc: 'Awaiting customer' },
  { value: 'resolved', stepNumber: 5, label: 'Resolved', icon: '✅', desc: 'Permanently resolved' },
];

function getDepartment(category?: string | null, reasonCode?: string | null): string {
  const c = ((category ?? reasonCode) || '').toUpperCase();
  if (c.includes('SHIP') || c.includes('DELIVERY') || c.includes('CARRIER') || c.includes('TRACK')) {
    return 'Shipping & Logistics';
  }
  if (c.includes('PAY') || c.includes('CHARGE') || c.includes('REFUND') || c.includes('BILL')) {
    return 'Payments & Billing';
  }
  if (c.includes('INVENTORY') || c.includes('STOCK') || c.includes('RESERV')) {
    return 'Inventory & Warehouse';
  }
  return 'Customer Support Operations';
}

export function TicketWorkspace({ ticketId, onOpenOrder, onBack, currentUser }: Props) {
  const detail = usePolling(() => getTicket(ticketId), ticketId, 3000);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [isAssigneeDirty, setIsAssigneeDirty] = useState(false);
  const [departmentInput, setDepartmentInput] = useState('');
  const [isDeptDirty, setIsDeptDirty] = useState(false);
  const [resolutionNotesInput, setResolutionNotesInput] = useState('');
  const [isNotesDirty, setIsNotesDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<SupportMember[]>(() => getSupportTeam());

  const isAdmin = Boolean(
    currentUser &&
      ((currentUser.role || '').toLowerCase().includes('admin') ||
        (currentUser.id || '').toUpperCase().startsWith('ADM')),
  );

  useEffect(() => {
    const handleTeamUpdate = () => setTeamMembers(getSupportTeam());
    window.addEventListener('relay-team-updated', handleTeamUpdate);
    return () => window.removeEventListener('relay-team-updated', handleTeamUpdate);
  }, []);

  useEffect(() => {
    setIsAssigneeDirty(false);
    setIsDeptDirty(false);
    setIsNotesDirty(false);
    setError(null);
    setNotice(null);
  }, [ticketId]);

  useEffect(() => {
    if (detail.data) {
      if (!isAssigneeDirty) {
        const val = detail.data.assigned_to && detail.data.assigned_to !== 'Unassigned' ? detail.data.assigned_to : '';
        setAssigneeInput(val);
      }
      if (!isDeptDirty) {
        const currentDept = detail.data.department || getDepartment(detail.data.ticket.category, detail.data.ticket.reason_code);
        setDepartmentInput(currentDept);
      }
      if (!isNotesDirty) {
        const notes = detail.data.resolution_notes || detail.data.ticket.resolution_summary || '';
        setResolutionNotesInput(notes);
      }
    }
  }, [detail.data, isAssigneeDirty, isDeptDirty, isNotesDirty]);

  const setTicketStatus = async (newStatus: string, simulateDays?: number) => {
    setStatusBusy(true);
    setError(null);
    setNotice(null);
    try {
      const notesToSave = resolutionNotesInput.trim() || undefined;
      await updateTicketStatus(ticketId, newStatus, simulateDays, undefined, undefined, notesToSave);
      setNotice(`Ticket status updated to "${humanize(newStatus)}"${notesToSave ? ' with resolution notes.' : '.'}`);
      setIsNotesDirty(false);
      if (newStatus === 'resolved') {
        logTeamActivity(
          'ticket_resolved',
          `Case ${ticketId} resolved (${notesToSave ? 'with resolution notes' : 'permanently'})`,
          assigneeInput || 'Support Specialist',
          ticketId,
        );
      }
      await detail.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveAssignee = async (forcedName?: string) => {
    const val = (forcedName !== undefined ? forcedName : assigneeInput).trim() || 'Unassigned';
    setStatusBusy(true);
    setError(null);
    try {
      await updateTicketStatus(
        ticketId,
        undefined,
        undefined,
        val,
        undefined,
        undefined,
        currentUser?.role,
        currentUser?.id,
      );
      setNotice(`Assigned person updated to "${val}" in database.`);
      setIsAssigneeDirty(false);
      setAssigneeInput(val === 'Unassigned' ? '' : val);
      if (detail.data) {
        detail.data.assigned_to = val;
      }
      logTeamActivity(
        'ticket_assigned',
        `Assigned case ${ticketId} to ${val}`,
        currentUser?.name || 'Admin Operator',
        ticketId,
      );
      await detail.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveDepartment = async (deptName: string) => {
    const val = deptName.trim();
    if (!val) return;
    setStatusBusy(true);
    setError(null);
    try {
      await updateTicketStatus(ticketId, undefined, undefined, undefined, val);
      setNotice(`Department updated to "${val}"`);
      setIsDeptDirty(false);
      setDepartmentInput(val);
      await detail.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveResolutionNotes = async (forcedNotes?: string) => {
    const val = (forcedNotes !== undefined ? forcedNotes : resolutionNotesInput).trim();
    setStatusBusy(true);
    setError(null);
    try {
      await updateTicketStatus(ticketId, undefined, undefined, undefined, undefined, val);
      setNotice('Resolution notes saved.');
      setIsNotesDirty(false);
      await detail.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const dispatch = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await dispatchTicket(ticketId);
      setNotice(`Recovery job ${res.job_id} queued. Recovery runs outside the chat/API request.`);
      await detail.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading && !detail.data) return <Skeleton lines={8} label="Loading ticket" />;
  if (!detail.data) {
    return (
      <ErrorState
        title="Could not load ticket"
        message={detail.error ?? 'Unknown error'}
        onRetry={() => void detail.refresh()}
      />
    );
  }

  const data: TicketDetail = detail.data;
  const ticket = data.ticket;
  const citations = ticket.citations ?? [];
  const conversation = data.conversation;
  const opStatus = getOperationalTicketStatus(ticket.status, ticket.updated_at, data.operator_status);
  const isResolved = opStatus.raw === 'resolved';
  const queryText = data.query || ticket.confirmed_summary || ticket.summary || humanize((ticket.category ?? ticket.reason_code).toLowerCase());
  const dept = data.department || getDepartment(ticket.category, ticket.reason_code);
  const assignee = data.assigned_to || 'Unassigned';
  const isAssigned = assignee !== 'Unassigned' && Boolean(assignee.trim());
  const canReassign = isAdmin || !isAssigned;
  const customerName = data.customer ? `${data.customer.name} (${data.customer.email})` : 'Customer';
  const raisedAt = data.raised_at || ticket.created_at;
  const resolvedAt = data.resolved_at || (isResolved ? ticket.updated_at : null);

  const currentStageIndex = STEPPER_STAGES.findIndex((s) => s.value === opStatus.raw);

  return (
    <div className="workspace ticket-workspace google-resource-view" style={{ width: '100%' }}>
      {/* Google Cloud Resource Header Card */}
      <div className="google-resource-header google-card">
        <div className="google-resource-header__top">
          <div className="google-resource-title-group">
            <div className="google-service-icon" aria-hidden="true">
              🎫
            </div>
            <div>
              <nav aria-label="Breadcrumb" className="google-breadcrumb">
                <ol>
                  {onBack && (
                    <li>
                      <button type="button" className="google-breadcrumb-link" onClick={onBack}>
                        Support Tickets
                      </button>
                    </li>
                  )}
                  <li aria-current="page">Case Details</li>
                </ol>
              </nav>
              <div className="google-title-row">
                <div className="google-title-text">
                  Resource: <span className="google-chip-id">{ticket.id}</span>
                </div>
                <StatusChip status={opStatus.raw} kind="ticket" label={opStatus.label} />
                {data.pending_approval_id && <span className="badge badge--attention">Human approval pending</span>}
                {isResolved && data.verified && (
                  <span className="badge badge--allowed">✓ Verification passed against the live service records</span>
                )}
              </div>
            </div>
          </div>

          <div className="google-header-actions">
            {!isResolved && (
              <button
                type="button"
                className="btn btn--sm google-btn-resolve"
                disabled={statusBusy || busy}
                onClick={() => {
                  if (window.confirm('Are you sure you want to mark this ticket as RESOLVED? Once resolved, it is permanently locked and cannot be reopened.')) {
                    void setTicketStatus('resolved');
                  }
                }}
              >
                ✓ Resolve Ticket
              </button>
            )}
          </div>
        </div>

        {/* Google Cloud Resource Metrics Strip */}
        <div className="google-metric-ribbon">
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">TICKET ID</span>
            <span className="google-metric-tile__value"><code>{ticket.id}</code></span>
          </div>
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">CUSTOMER</span>
            <span className="google-metric-tile__value" title={customerName}>{customerName}</span>
          </div>
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">DEPARTMENT</span>
            <span className="google-metric-tile__value">{dept}</span>
          </div>
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">CURRENT STATUS</span>
            <span className="google-metric-tile__value">{opStatus.label}</span>
          </div>
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">ASSIGNED SPECIALIST</span>
            <span className="google-metric-tile__value">{assignee}</span>
          </div>
          <div className="google-metric-tile">
            <span className="google-metric-tile__label">DATE RAISED</span>
            <span className="google-metric-tile__value">{formatDateTime(raisedAt)}</span>
          </div>
        </div>
      </div>

      {/* Google Material 3 Stepper (Interactive Pipeline Progression) */}
      <section className="google-stepper-card google-card" aria-label="Ticket Workflow Stepper">
        <div className="google-stepper-head">
          <span className="google-stepper-title">
            <span className="google-stepper-badge-icon">⚡</span> Workflow Stage Stepper
          </span>
          <span className="muted small">
            {isResolved
              ? '🔒 Ticket is locked in Resolved state.'
              : 'Click any stage to update the workflow status in real time.'}
          </span>
        </div>

        <div className="google-stepper-track-wrap">
          <div className="google-stepper-track">
            {STEPPER_STAGES.map((st, idx) => {
              const isActive = opStatus.raw === st.value;
              const isPast = isResolved ? true : currentStageIndex !== -1 && idx < currentStageIndex;

              let nodeClass = 'google-step-node';
              if (isActive) nodeClass += ' is-active';
              if (isPast && !isActive) nodeClass += ' is-complete';
              if (!isActive && !isPast) nodeClass += ' is-future';

              return (
                <button
                  key={st.value}
                  type="button"
                  className={nodeClass}
                  disabled={isResolved || statusBusy}
                  onClick={() => {
                    if (isResolved || statusBusy || isActive) return;
                    if (st.value === 'resolved') {
                      if (window.confirm('Are you sure you want to mark this ticket as RESOLVED? Once resolved, it is permanently locked and cannot be reopened.')) {
                        void setTicketStatus('resolved');
                      }
                    } else {
                      void setTicketStatus(st.value);
                    }
                  }}
                  title={`Transition to ${st.label}`}
                >
                  <div className="google-step-circle">
                    {isPast && !isActive ? '✓' : st.stepNumber}
                  </div>
                  <div className="google-step-content">
                    <span className="google-step-name">
                      <span aria-hidden="true">{st.icon} </span>{st.label}
                    </span>
                    <span className="google-step-desc">{st.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {detail.error && <InlineError message={`Ticket refresh failed: ${detail.error}. Showing last known data.`} />}
      {error && <InlineError message={error} />}
      {notice && (
        <div className="notice google-notice" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* Main Operational Ticket Details Hero Card */}
      <section className="panel ticket-interface-hero google-card" aria-labelledby="ticket-hero-title">
        <div className="panel__head google-card__head">
          <div>
            <h2 id="ticket-hero-title" className="panel__title" style={{ fontSize: '1.25rem' }}>
              Ticket Details · <code>{ticket.id}</code>
            </h2>
            <p className="muted small">
              Raised {formatDateTime(raisedAt)} · Last updated {formatDateTime(ticket.updated_at || ticket.created_at)}
            </p>
          </div>
          <div>
            <StatusChip status={opStatus.raw} kind="ticket" label={opStatus.label} />
          </div>
        </div>

        {/* Operational Fields Grid */}
        <div className="ticket-hero-fields google-fields-grid">
          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">Ticket Number</span>
            <div className="ticket-hero-field__value">
              <code style={{ fontSize: '1.05rem', color: 'var(--accent, #1a73e8)' }}>{ticket.id}</code>
            </div>
          </div>

          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">Who Raised the Ticket</span>
            <div className="ticket-hero-field__value" style={{ fontWeight: 600 }}>
              {customerName}
            </div>
          </div>

          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">Department</span>
            <div className="ticket-hero-field__value" style={{ marginTop: '4px' }}>
              <select
                value={DEPARTMENTS.some((d) => d.value === (departmentInput || dept)) ? (departmentInput || dept) : DEPARTMENTS[0]?.value}
                onChange={(e) => {
                  setDepartmentInput(e.target.value);
                  void handleSaveDepartment(e.target.value);
                }}
                disabled={isResolved || statusBusy}
                className="google-select"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: isResolved ? 'not-allowed' : 'pointer',
                }}
                aria-label="Change department"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">Current Status</span>
            <div className="ticket-hero-field__value" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={opStatus.raw}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'resolved') {
                      if (window.confirm('Are you sure you want to mark this ticket as RESOLVED? Once resolved, it is permanently locked and cannot be reopened.')) {
                        void setTicketStatus('resolved');
                      }
                    } else {
                      void setTicketStatus(val);
                    }
                  }}
                  disabled={isResolved || statusBusy}
                  className="google-select"
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    cursor: isResolved ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="Change current status"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <StatusChip status={opStatus.raw} kind="ticket" label={opStatus.label} />
              </div>
              {opStatus.daysOnHold !== undefined && opStatus.daysOnHold > 0 && (
                <span className="muted small">({opStatus.daysOnHold} day{opStatus.daysOnHold > 1 ? 's' : ''} on hold)</span>
              )}
            </div>
          </div>

          <div className="ticket-hero-field google-field-box" style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span className="ticket-hero-field__label">Who is Working on This Ticket (Assigned Person)</span>
              {isAssigned && !isAdmin && (
                <span className="tag" style={{ background: '#fef7e0', color: '#b06000', border: '1px solid #f9ab00', fontWeight: 600, fontSize: '0.78rem' }}>
                  🔒 Admin Policy: Reassignment Restricted
                </span>
              )}
            </div>

            {!canReassign ? (
              <div
                style={{
                  marginTop: '8px',
                  padding: '12px 16px',
                  background: 'var(--surface-2, #f8fafc)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔒</span>
                  <div>
                    <div style={{ fontSize: '0.95rem' }}>
                      Assigned to: <strong>{assignee}</strong>
                    </div>
                    <div className="muted small" style={{ marginTop: '2px' }}>
                      Once assigned by admin, this ticket cannot be reassigned to another person. Only an Administrator can change the assigned person.
                    </div>
                  </div>
                </div>
                <span className="badge" style={{ background: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                  Active Specialist
                </span>
              </div>
            ) : (
              <div className="ticket-hero-field__value" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={assigneeInput}
                  onChange={(e) => {
                    setAssigneeInput(e.target.value);
                    setIsAssigneeDirty(true);
                  }}
                  placeholder="Assignee name (e.g. Sarah Jenkins)"
                  disabled={isResolved || statusBusy}
                  className="google-input"
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', flex: 1, minWidth: '220px', maxWidth: '340px' }}
                />
                <button
                  type="button"
                  className="btn btn--sm btn--primary google-btn"
                  disabled={isResolved || statusBusy}
                  onClick={() => void handleSaveAssignee()}
                >
                  Save Assignee
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--secondary google-btn-outlined"
                  disabled={isResolved || statusBusy}
                  onClick={() => {
                    const myName = currentUser?.name || 'Admin Operator';
                    setAssigneeInput(myName);
                    setIsAssigneeDirty(true);
                    void handleSaveAssignee(myName);
                  }}
                >
                  Assign to Me
                </button>
                {assignee !== 'Unassigned' && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost google-btn-ghost"
                    disabled={isResolved || statusBusy}
                    onClick={() => {
                      setAssigneeInput('');
                      setIsAssigneeDirty(true);
                      void handleSaveAssignee('Unassigned');
                    }}
                  >
                    Clear
                  </button>
                )}

                {/* Quick Select Support Team Specialist */}
                <select
                  className="google-select"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.85rem',
                    maxWidth: '220px',
                    cursor: isResolved || statusBusy ? 'not-allowed' : 'pointer',
                  }}
                  disabled={isResolved || statusBusy}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      const chosen = e.target.value;
                      setAssigneeInput(chosen);
                      setIsAssigneeDirty(true);
                      void handleSaveAssignee(chosen);
                    }
                  }}
                  aria-label="Quick assign to team specialist"
                >
                  <option value="">👥 Reassign to Specialist...</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
                <span className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="google-avatar-dot">👷</span>
                  Currently assigned: <strong>{assignee}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="ticket-hero-field google-field-box" style={{ gridColumn: 'span 2' }}>
            <span className="ticket-hero-field__label">What's the Query</span>
            <div className="ticket-hero-field__value google-query-box" style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, background: 'var(--surface-2, #f8fafc)', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {queryText}
            </div>
          </div>

          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">When Raised</span>
            <div className="ticket-hero-field__value">
              {formatDateTime(raisedAt)}
            </div>
          </div>

          <div className="ticket-hero-field google-field-box">
            <span className="ticket-hero-field__label">When Resolved</span>
            <div className="ticket-hero-field__value">
              {resolvedAt ? (
                <span style={{ color: 'var(--ok, #1e8e3e)', fontWeight: 600 }}>{formatDateTime(resolvedAt)}</span>
              ) : (
                <span className="muted">Not resolved yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Status Action Controls */}
        <div className="status-actions google-actions-strip" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <span className="status-actions__label" style={{ fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Quick Status Actions:
          </span>

          {isResolved ? (
            <div
              className="locked-resolution-banner google-locked-box"
              style={{
                background: 'rgba(30, 142, 62, 0.08)',
                border: '1.5px solid #1e8e3e',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#1e8e3e',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              🔒 Ticket is Resolved. Once a ticket is resolved, it cannot be reopened, retried, or unheld.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn--sm google-chip-btn ${opStatus.raw === 'awaiting' ? 'btn--primary google-chip--active' : 'btn--secondary'}`}
                disabled={statusBusy || busy}
                onClick={() => void setTicketStatus('awaiting')}
              >
                <span aria-hidden="true">⏳ </span>New Ticket
              </button>
              <button
                type="button"
                className={`btn btn--sm google-chip-btn ${opStatus.raw === 'working' ? 'btn--primary google-chip--active' : 'btn--secondary'}`}
                disabled={statusBusy || busy}
                onClick={() => void setTicketStatus('working')}
              >
                <span aria-hidden="true">⚙️ </span>Working
              </button>
              <button
                type="button"
                className={`btn btn--sm google-chip-btn ${opStatus.raw === 'on_hold' ? 'btn--primary google-chip--active' : 'btn--secondary'}`}
                disabled={statusBusy || busy}
                onClick={() => void setTicketStatus('on_hold')}
              >
                <span aria-hidden="true">⏸️ </span>Hold
              </button>
              <button
                type="button"
                className={`btn btn--sm google-chip-btn ${opStatus.raw === 'awaiting_caller' ? 'btn--primary google-chip--active' : 'btn--secondary'}`}
                disabled={statusBusy || busy}
                onClick={() => void setTicketStatus('awaiting_caller')}
              >
                <span aria-hidden="true">📞 </span>Waiting for caller confirmation
              </button>
              <button
                type="button"
                className={`btn btn--sm google-chip-btn ${opStatus.raw === 'resolved' ? 'btn--primary google-chip--active' : 'btn--secondary'}`}
                disabled={statusBusy || busy}
                onClick={() => {
                  if (window.confirm('Are you sure you want to mark this ticket as RESOLVED? Once resolved, it is permanently locked and cannot be reopened.')) {
                    void setTicketStatus('resolved');
                  }
                }}
                style={{ borderColor: '#1e8e3e', color: '#1e8e3e', fontWeight: 600 }}
              >
                ✓ Resolve (Permanent)
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost google-chip-btn"
                title="Simulate ticket on hold for > 3 days to verify automated escalation"
                disabled={statusBusy || busy}
                onClick={() => void setTicketStatus('on_hold', 4)}
              >
                Simulate On Hold &gt; 3 Days
              </button>
            </div>
          )}
        </div>

        {/* Resolution Notes Section (Google Keep / Docs style) */}
        <div className="resolution-notes-section google-docs-publisher" style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="google-docs-icon" aria-hidden="true">📝</span>
              Resolution Notes
              {isResolved && <span className="badge badge--allowed" style={{ fontSize: '0.75rem' }}>✓ Resolved</span>}
            </span>
            {!isResolved && (
              <span className="muted small">
                Document root cause, investigation steps, and customer outcome.
              </span>
            )}
          </div>

          {isResolved ? (
            <div
              className="resolution-notes-view google-docs-resolved-card"
              style={{
                background: 'var(--surface-2, #f8fafc)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                lineHeight: 1.6,
                fontSize: '0.95rem',
              }}
            >
              <div style={{ fontWeight: 600, color: '#1e8e3e', marginBottom: '6px', fontSize: '0.85rem' }}>
                Resolution Summary &amp; Notes:
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {data.resolution_notes || ticket.resolution_summary || (
                  <span className="muted">No resolution notes were provided when this ticket was resolved.</span>
                )}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={resolutionNotesInput}
                onChange={(e) => {
                  setResolutionNotesInput(e.target.value);
                  setIsNotesDirty(true);
                }}
                placeholder="Enter resolution notes, specialist comments, or actions taken to resolve this ticket…"
                rows={3}
                disabled={statusBusy}
                className="google-textarea"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  fontFamily: 'inherit',
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
                aria-label="Resolution notes"
              />

              {/* Quick Template Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted small" style={{ fontSize: '0.8rem' }}>Smart note templates:</span>
                {[
                  'Shipment tracking verified with carrier and relayed to customer.',
                  'Payment capture confirmed; inventory reservation fulfilled.',
                  'Refund approved and processed back to original payment method.',
                  'Customer query resolved via policy guidance.',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="btn btn--sm btn--ghost google-suggestion-chip"
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    onClick={() => {
                      setResolutionNotesInput(tpl);
                      setIsNotesDirty(true);
                    }}
                  >
                    + {tpl.slice(0, 32)}…
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn--sm btn--primary google-btn"
                  disabled={statusBusy || !resolutionNotesInput.trim()}
                  onClick={() => void handleSaveResolutionNotes()}
                >
                  Save Resolution Notes
                </button>
                {resolutionNotesInput.trim() && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost google-btn-ghost"
                    disabled={statusBusy}
                    onClick={() => {
                      setResolutionNotesInput('');
                      setIsNotesDirty(true);
                    }}
                  >
                    Clear Notes
                  </button>
                )}
                {(data.resolution_notes || ticket.resolution_summary) && !isNotesDirty && (
                  <span className="muted small" style={{ marginLeft: 'auto' }}>
                    Currently saved: <em>&quot;{data.resolution_notes || ticket.resolution_summary}&quot;</em>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Linked Order & Recovery Run Information */}
      <section className="panel google-card" aria-labelledby="linked-resources-title" style={{ marginBottom: '20px' }}>
        <div className="panel__head google-card__head">
          <h3 id="linked-resources-title" className="panel__title">
            Linked Order &amp; Recovery State
          </h3>
          {data.pending_approval_id && (
            <span className="muted small">A human decision is required in the linked order workspace below.</span>
          )}
        </div>

        <dl className="kv-grid kv-grid--wide">
          <div>
            <dt>Linked Order</dt>
            <dd>
              {data.order ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <code>{data.order.id}</code> · <strong>{data.order.status}</strong> ·{' '}
                  {formatMoney(data.order.total_cents, data.order.currency)}
                  <button type="button" className="link-btn google-link" onClick={() => onOpenOrder(data.order!.id)}>
                    Open order workspace →
                  </button>
                </div>
              ) : (
                'No order linked'
              )}
            </dd>
          </div>
          <div>
            <dt>Reason / Category</dt>
            <dd>
              <code>{ticket.category ?? ticket.reason_code}</code>
            </dd>
          </div>
          <div>
            <dt>Background Job / Run</dt>
            <dd>
              {data.run ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <code>{data.run.id}</code>
                  <StatusChip kind="run" status={data.run.status} />
                  {data.run.outcome && <StatusChip kind="outcome" status={data.run.outcome} />}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="muted">No recovery job has run yet.</span>
                  {!isResolved && (
                    <button type="button" className="btn btn--secondary btn--sm google-btn-outlined" disabled={busy} onClick={() => void dispatch()}>
                      {busy ? 'Dispatching…' : 'Dispatch recovery job'}
                    </button>
                  )}
                </div>
              )}
            </dd>
          </div>
          {ticket.resolution_summary && (
            <div style={{ gridColumn: 'span 2' }}>
              <dt>Resolution Summary</dt>
              <dd>{ticket.resolution_summary}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Customer Conversation Transcript */}
      {conversation && conversation.messages.length > 0 && (
        <section className="panel google-card" aria-labelledby="chat-transcript-title" style={{ marginBottom: '20px' }}>
          <div className="panel__head google-card__head">
            <h3 id="chat-transcript-title" className="panel__title">
              Customer Conversation Transcript
            </h3>
            <span className="muted small">Conversation ID: <code>{conversation.id}</code></span>
          </div>
          <div className="conversation-transcript google-transcript">
            {conversation.messages.map((m) => (
              <div key={m.id} className={`chat-message chat-message--${m.role}`}>
                <div className="chat-message__head">
                  <strong>{m.role === 'customer' ? customerName : 'Support Agent'}</strong> ·{' '}
                  <span className="muted small">{formatDateTime(m.created_at)}</span>
                </div>
                <div className="chat-message__body" style={{ whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grounded Policy Citations */}
      {citations.length > 0 && (
        <section className="panel google-card" aria-labelledby="citations-title" style={{ marginBottom: '20px' }}>
          <h3 id="citations-title" className="panel__title google-card__head">
            Grounded Policy Citations
          </h3>
          <PolicyCitations citations={citations} />
        </section>
      )}
    </div>
  );
}

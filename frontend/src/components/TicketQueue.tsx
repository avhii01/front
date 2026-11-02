import { useMemo, useState } from 'react';
import { formatDateTime, humanize } from '../format';
import type { TicketListItem } from '../types';
import { EmptyState, ErrorState, Skeleton } from './States';
import { StatusChip, getOperationalTicketStatus } from './StatusChip';

interface Props {
  tickets: TicketListItem[] | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

const DEPT_ICONS: Record<string, string> = {
  'Shipping & Logistics': '🚚',
  'Payments & Billing': '💳',
  'Inventory & Warehouse': '📦',
  'Customer Support Operations': '🎧',
};

const FILTER_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Tickets' },
  { value: 'awaiting', label: 'New Tickets' },
  { value: 'working', label: 'Working' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'awaiting_caller', label: 'Waiting for Caller' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

export function TicketQueue({ tickets, loading, error, selectedId, onSelect, onRetry }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((item) => {
      const t = item.ticket;
      const op = getOperationalTicketStatus(t.status, t.updated_at, item.operator_status);
      if (statusFilter !== 'all' && op.raw !== statusFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const idMatch = t.id.toLowerCase().includes(q);
      const custMatch = item.customer ? `${item.customer.name} ${item.customer.email}`.toLowerCase().includes(q) : false;
      const deptMatch = (item.department || '').toLowerCase().includes(q);
      const queryMatch = (item.query || t.confirmed_summary || t.summary || '').toLowerCase().includes(q);
      const assigneeMatch = (item.assigned_to || '').toLowerCase().includes(q);
      return idMatch || custMatch || deptMatch || queryMatch || assigneeMatch;
    });
  }, [tickets, search, statusFilter]);

  // Summary counts for Google Cloud style stats
  const stats = useMemo(() => {
    if (!tickets) return { total: 0, awaiting: 0, working: 0, resolved: 0 };
    let awaiting = 0;
    let working = 0;
    let resolved = 0;
    tickets.forEach((it) => {
      const op = getOperationalTicketStatus(it.ticket.status, it.ticket.updated_at, it.operator_status);
      if (op.raw === 'awaiting') awaiting++;
      else if (op.raw === 'working') working++;
      else if (op.raw === 'resolved') resolved++;
    });
    return { total: tickets.length, awaiting, working, resolved };
  }, [tickets]);

  let body;
  if (tickets === null && loading) {
    body = <Skeleton lines={5} label="Loading tickets" />;
  } else if (tickets === null) {
    body = <ErrorState title="Could not load tickets" message={error ?? 'Unknown error'} onRetry={onRetry} />;
  } else if (tickets.length === 0) {
    body = (
      <EmptyState title="No support tickets">
        Customer-confirmed support tickets appear here. Open the Customer Support Chat to raise a ticket.
      </EmptyState>
    );
  } else {
    body = (
      <>
        {error && (
          <p className="inline-error google-error-banner" role="alert">
            Refresh failed ({error}). Showing last known data.{' '}
            <button type="button" className="link-btn google-link" onClick={onRetry}>
              Retry
            </button>
          </p>
        )}

        {/* Google Cloud Overview KPI Cards */}
        <div className="google-kpi-strip">
          <div className="google-kpi-card" onClick={() => setStatusFilter('all')}>
            <span className="google-kpi-label">TOTAL TICKETS</span>
            <span className="google-kpi-val" style={{ color: 'var(--accent, #1a73e8)' }}>{stats.total} active</span>
          </div>
          <div className="google-kpi-card" onClick={() => setStatusFilter('awaiting')}>
            <span className="google-kpi-label">NEW TICKETS</span>
            <span className="google-kpi-val" style={{ color: '#f29900' }}>{stats.awaiting} pending</span>
          </div>
          <div className="google-kpi-card" onClick={() => setStatusFilter('working')}>
            <span className="google-kpi-label">IN PROGRESS</span>
            <span className="google-kpi-val" style={{ color: '#1a73e8' }}>{stats.working} active</span>
          </div>
          <div className="google-kpi-card" onClick={() => setStatusFilter('resolved')}>
            <span className="google-kpi-label">RESOLVED</span>
            <span className="google-kpi-val" style={{ color: '#1e8e3e' }}>{stats.resolved} done</span>
          </div>
        </div>

        {/* Google Cloud Style Filter & Search Toolbar */}
        <div className="google-toolbar">
          <div className="google-search-container">
            <span className="google-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ticket ID, customer, department, or query text…"
              className="google-input google-search-input"
              aria-label="Filter tickets"
            />
            {search && (
              <button type="button" className="google-clear-search" onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>

          <div className="google-filter-chips">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`google-filter-chip ${statusFilter === tab.value ? 'is-active' : ''}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <EmptyState title="No matching tickets">
            No tickets match your search &quot;{search}&quot; or status filter.
          </EmptyState>
        ) : (
          <ul className="queue queue--tickets-grid google-resource-grid" aria-label="Support tickets list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
            {filteredTickets.map((item) => (
              <li key={item.ticket.id}>
                <TicketRow item={item} selected={item.ticket.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className="panel google-card google-listview-panel" aria-labelledby="ticket-queue-title" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="panel__head google-card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="google-service-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            🎫
          </div>
          <div>
            <h2 id="ticket-queue-title" className="panel__title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              Support Tickets Queue {tickets && <span className="count">{tickets.length}</span>}
            </h2>
            <span className="muted small">
              Google Cloud Console Operations · Select any ticket to inspect, assign, or resolve.
            </span>
          </div>
        </div>
      </div>
      {body}
    </section>
  );
}

export function TicketRow({
  item,
  selected,
  onSelect,
}: {
  item: TicketListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = item.ticket;
  const op = getOperationalTicketStatus(t.status, t.updated_at, item.operator_status);
  const categoryLabel = humanize((t.category ?? t.reason_code).toLowerCase());
  const queryText = item.query || t.confirmed_summary || t.summary || categoryLabel;
  const dept = item.department || 'Customer Support Operations';
  const deptIcon = DEPT_ICONS[dept] || '🏢';
  const assignee = item.assigned_to || 'Unassigned';
  const customerName = item.customer ? item.customer.name : 'Customer';
  const customerEmail = item.customer?.email ? ` (${item.customer.email})` : '';
  const raisedAt = item.raised_at || t.created_at;
  const resolvedAt = item.resolved_at || (op.raw === 'resolved' ? t.updated_at : null);

  // Status border indicator color
  let statusBorderColor = '#1a73e8';
  if (op.raw === 'awaiting') statusBorderColor = '#f29900';
  else if (op.raw === 'resolved') statusBorderColor = '#1e8e3e';
  else if (op.raw === 'on_hold') statusBorderColor = '#f9ab00';
  else if (op.raw === 'escalated') statusBorderColor = '#d93025';

  return (
    <button
      type="button"
      className={`queue__item google-ticket-card${selected ? ' is-selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
      aria-label={`Ticket ${t.id}, status ${op.label}, customer ${customerName}, department ${dept}, assigned to ${assignee}`}
      onClick={() => onSelect(t.id)}
      data-testid={`ticket-item-${t.id}`}
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1.5px solid var(--border)',
        borderLeft: `5px solid ${statusBorderColor}`,
        background: 'var(--surface)',
        display: 'grid',
        gap: '10px',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span className="queue__row" style={{ gap: '10px', alignItems: 'center' }}>
          <span className="queue__id google-card-id" style={{ fontWeight: 700, fontSize: '1.08rem', color: 'var(--accent, #1a73e8)' }}>
            {t.id}
          </span>
          <StatusChip status={op.raw} kind="ticket" label={op.label} />
          <span className="tag google-category-tag" style={{ fontSize: '0.8rem' }}>{categoryLabel}</span>
        </span>
        <span className="link-btn google-link" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
          View Details →
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="google-avatar-circle" aria-hidden="true">
            {customerName.charAt(0).toUpperCase()}
          </span>
          <strong>{customerName}</strong>
          <span className="muted small">{customerEmail}</span>
        </span>
        <span className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span>{deptIcon} <strong>{dept}</strong></span>
          <span>👷 {assignee}</span>
        </span>
      </div>

      <div
        className="queue__symptom google-query-preview"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.5,
          background: 'var(--surface-2, #f8fafc)',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-light, #e2e8f0)',
          fontSize: '0.92rem',
        }}
        title={queryText}
      >
        💬 {queryText}
      </div>

      {item.pending_approval_id && (
        <span className="queue__row queue__row--meta">
          <span className="badge badge--attention">Approval pending</span>
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem', color: 'var(--muted)' }}>
        <span>Raised: {formatDateTime(raisedAt)}</span>
        {resolvedAt ? (
          <span style={{ color: 'var(--ok, #1e8e3e)', fontWeight: 600 }}>✓ Resolved: {formatDateTime(resolvedAt)}</span>
        ) : (
          <span>Not resolved yet</span>
        )}
      </div>
    </button>
  );
}

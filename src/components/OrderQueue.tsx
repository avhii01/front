import { formatDateTime, formatMoney, humanize } from '../format';
import type { OrderListItem } from '../types';
import { EmptyState, ErrorState, Skeleton } from './States';
import { StatusChip } from './StatusChip';

interface Props {
  orders: OrderListItem[] | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export function OrderQueue({ orders, loading, error, selectedId, onSelect, onRetry }: Props) {
  let body;
  if (orders === null && loading) {
    body = <Skeleton lines={5} label="Loading orders" />;
  } else if (orders === null) {
    body = <ErrorState title="Could not load orders" message={error ?? 'Unknown error'} onRetry={onRetry} />;
  } else if (orders.length === 0) {
    body = <EmptyState title="No orders yet">Inject a failure scenario above to create a broken order to recover.</EmptyState>;
  } else {
    body = (
      <>
        {error && (
          <p className="inline-error" role="alert">
            Refresh failed ({error}). Showing last known data.{' '}
            <button type="button" className="link-btn" onClick={onRetry}>
              Retry
            </button>
          </p>
        )}
        <ul className="queue" aria-label="Order queue">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} selected={o.id === selectedId} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <section className="panel" aria-labelledby="queue-title">
      <h2 id="queue-title" className="panel__title">
        Order queue {orders && <span className="count">{orders.length}</span>}
      </h2>
      {body}
    </section>
  );
}

export function OrderRow({ order, selected, onSelect }: { order: OrderListItem; selected: boolean; onSelect: (id: string) => void }) {
  const run = order.latest_run;
  return (
    <button
      type="button"
      className={`queue__item${selected ? ' is-selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
      aria-label={`Order ${order.id}, status ${humanize(order.status)}${run ? `, latest run ${humanize(run.status)}` : ', no run yet'}${
        order.pending_approval_id ? ', approval pending' : ''
      }`}
      onClick={() => onSelect(order.id)}
    >
      <span className="queue__row">
        <span className="queue__id">{order.id}</span>
        <StatusChip kind="order" status={order.status} />
        <span className="queue__money">{formatMoney(order.total_cents, order.currency)}</span>
      </span>
      {order.workflow_error && (
        <span className="queue__symptom" title="Untrusted workflow error text">
          {order.workflow_error}
        </span>
      )}
      <span className="queue__row queue__row--meta">
        {run ? (
          <>
            <StatusChip kind="run" status={run.status} />
            {run.outcome && <StatusChip kind="outcome" status={run.outcome} />}
          </>
        ) : (
          <span className="muted small">No run yet</span>
        )}
        {order.pending_approval_id && <span className="badge badge--attention">⏳ Approval pending</span>}
      </span>
      {order.ticket_reasons.length > 0 && (
        <span className="queue__row queue__row--meta">
          {order.ticket_reasons.map((r, i) => (
            <span key={`${r}-${i}`} className="tag" title="Support ticket reason">
              🎫 {r}
            </span>
          ))}
        </span>
      )}
      <span className="queue__row queue__row--meta muted small">
        {order.scenario_label && <span>{order.scenario_label}</span>}
        <span>{formatDateTime(order.created_at)}</span>
      </span>
    </button>
  );
}

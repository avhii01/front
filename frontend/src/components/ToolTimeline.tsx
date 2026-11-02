import { formatDuration, formatTime } from '../format';
import type { ToolCall } from '../types';
import { EmptyState } from './States';
import { JsonBlock } from './JsonBlock';
import { StatusChip } from './StatusChip';

export function ToolTimeline({ calls }: { calls: ToolCall[] }) {
  return (
    <section className="panel" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="panel__title">
        Tool execution timeline {calls.length > 0 && <span className="count">{calls.length}</span>}
      </h2>
      {calls.length === 0 ? (
        <EmptyState title="No tool calls yet">Tool calls appear here as the run executes each step.</EmptyState>
      ) : (
        <ol className="timeline">
          {calls.map((c) => (
            <TimelineItem key={c.seq} call={c} />
          ))}
        </ol>
      )}
    </section>
  );
}

export function TimelineItem({ call: c }: { call: ToolCall }) {
  const isRetry = c.attempt > 1;
  const isReconcile = c.purpose === 'reconcile';
  const cls = ['timeline__item', `is-${c.status}`, isRetry ? 'is-retry' : '', isReconcile ? 'is-reconcile' : ''].filter(Boolean).join(' ');
  return (
    <li className={cls} aria-label={`Step ${c.seq}: ${c.tool}, ${c.status}${isRetry ? `, retry attempt ${c.attempt}` : ''}${isReconcile ? ', reconciliation' : ''}`}>
      <div className="timeline__head">
        <span className="timeline__seq">#{c.seq}</span>
        <span className="timeline__tool">{c.tool}</span>
        <span className="tag" title="Graph node">
          node: {c.node}
        </span>
        {c.mutating ? (
          <span className="badge badge--mutating" title="This call changes state">
            ✎ MUTATING
          </span>
        ) : (
          <span className="tag" title="Read-only call">
            read-only
          </span>
        )}
        <StatusChip kind="tool" status={c.status} />
        {isRetry && <span className="badge badge--retry">↻ Retry · attempt {c.attempt}</span>}
        {!isRetry && c.attempt === 1 && c.mutating && <span className="tag">attempt 1</span>}
        {c.purpose && (isReconcile ? (
          <span className="badge badge--reconcile" title="Verifying whether an ambiguous earlier call took effect, instead of blindly retrying">
            ⇄ RECONCILE
          </span>
        ) : (
          <span className="tag">purpose: {c.purpose}</span>
        ))}
      </div>
      <div className="timeline__meta muted small">
        <span>{formatTime(c.started_at)}</span>
        <span>{formatDuration(c.duration_ms)}</span>
        {c.idempotency_key && (
          <span>
            idempotency key: <code>{c.idempotency_key}</code>
          </span>
        )}
      </div>
      {c.status === 'ambiguous' && (
        <p className="small">Outcome unknown (timeout after sending). The agent should reconcile before retrying.</p>
      )}
      {c.status === 'replayed' && <p className="small">Duplicate request recognised by its idempotency key; the stored result was returned and nothing ran twice.</p>}
      <div className="timeline__details">
        <JsonBlock label="Inputs" value={c.args} />
        <JsonBlock label="Output" value={c.result} />
        {c.error !== null && c.error !== undefined && <JsonBlock label="Error" value={c.error} open />}
      </div>
    </li>
  );
}

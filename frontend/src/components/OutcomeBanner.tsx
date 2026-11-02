import type { RunDetail } from '../types';
import { JsonBlock } from './JsonBlock';
import { StatusChip, toneFor } from './StatusChip';

const HEADLINES: Record<string, string> = {
  fulfilled: 'Order fulfilled',
  refunded: 'Order refunded',
  escalated: 'Escalated to a human',
  failed: 'Recovery failed',
};

const TERMINAL = ['succeeded', 'escalated', 'failed'];

export function OutcomeBanner({ run }: { run: RunDetail }) {
  if (!TERMINAL.includes(run.status)) return null;
  const outcome = run.outcome ?? (run.status === 'succeeded' ? 'fulfilled' : run.status);
  const tone = toneFor('outcome', outcome);
  const tickets = run.tickets.filter((t) => t.run_id === run.id || t.run_id === null);
  return (
    <section className={`banner banner--${tone}`} aria-label="Run outcome">
      <div className="banner__head">
        <h2 className="banner__title">{HEADLINES[outcome] ?? outcome}</h2>
        <StatusChip kind="outcome" status={outcome} />
      </div>
      {run.summary && <p>{run.summary}</p>}
      {run.error && <p className="inline-error">Run error: {run.error}</p>}
      {outcome === 'escalated' && (
        <div className="tickets">
          <h3 className="subhead">Support ticket</h3>
          {tickets.length === 0 ? (
            <p className="muted small">No ticket found for this run.</p>
          ) : (
            tickets.map((t) => (
              <article key={t.id} className="ticket" aria-label={`Support ticket ${t.id}`}>
                <p>
                  <strong>Reason:</strong> <code>{t.reason_code}</code> · priority {t.priority} · {t.status}
                </p>
                <p>{t.summary}</p>
                <JsonBlock label="Evidence summary" value={t.evidence} open />
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}

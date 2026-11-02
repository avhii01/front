import type { AgentMode, DecisionEntry } from '../types';
import { EmptyState } from './States';

export function DecisionsList({ decisions, mode }: { decisions: DecisionEntry[]; mode: AgentMode }) {
  return (
    <section className="panel" aria-labelledby="decisions-title">
      <h2 id="decisions-title" className="panel__title">
        Decisions {decisions.length > 0 && <span className="count">{decisions.length}</span>}
      </h2>
      <p className="muted small">
        Each entry is a <strong>stated rationale plus the evidence it cited</strong>, followed by the deterministic policy verdict. This is not
        chain-of-thought.{' '}
        {mode === 'demo' ? 'In demo mode the planner is a fixed rule set; no model is involved.' : 'In LLM mode the model only proposes; policy decides.'}
      </p>
      {decisions.length === 0 ? (
        <EmptyState title="No decisions yet">Proposals and policy verdicts appear here once the run starts.</EmptyState>
      ) : (
        <ol className="decisions">
          {decisions.map((d, i) => (
            <DecisionItem key={i} index={i + 1} entry={d} />
          ))}
        </ol>
      )}
    </section>
  );
}

export function DecisionItem({ entry: d, index }: { entry: DecisionEntry; index: number }) {
  const p = d.proposal;
  const ruleIds = Array.from(new Set([...(p.rule_id ? [p.rule_id] : []), ...d.rule_ids]));
  return (
    <li className={`decision ${d.allowed ? 'is-allowed' : 'is-denied'}`}>
      <div className="decision__head">
        <span className="timeline__seq">{index}</span>
        <span className="decision__action">
          {p.action === 'tool' ? p.tool ?? 'tool' : p.action.replace(/_/g, ' ')}
        </span>
        <span className={`badge badge--source badge--source-${p.source}`} title="Where the proposal came from">
          source: {p.source}
        </span>
        <span className={`badge ${d.allowed ? 'badge--allowed' : 'badge--denied'}`}>{d.allowed ? '✓ Allowed' : '✗ Denied'}</span>
      </div>
      {p.summary && <p className="decision__summary">{p.summary}</p>}
      {ruleIds.length > 0 && (
        <p className="small">
          Rules:{' '}
          {ruleIds.map((r) => (
            <code key={r} className="rule">
              {r}
            </code>
          ))}
        </p>
      )}
      {p.evidence_refs.length > 0 && (
        <p className="small">
          Evidence cited:{' '}
          {p.evidence_refs.map((r) => (
            <code key={r} className="rule">
              {r}
            </code>
          ))}
        </p>
      )}
      {d.reasons.length > 0 && (
        <ul className="reasons small">
          {d.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

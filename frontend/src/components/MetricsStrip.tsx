import { formatDuration, formatNumber, formatUsd } from '../format';
import type { AgentMode, RunMetrics } from '../types';

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="metric__value">{value}</div>
      <div className="metric__label">{label}</div>
    </div>
  );
}

export function MetricsStrip({ metrics, mode }: { metrics: RunMetrics; mode: AgentMode }) {
  const llm = metrics.llm;
  return (
    <section aria-label="Run metrics">
      <div className="metrics">
        <Metric label="Active time" value={formatDuration(metrics.active_ms)} />
        <Metric label="Wall time" value={formatDuration(metrics.wall_ms)} />
        <Metric label="Tool calls" value={metrics.tool_calls} />
        <Metric label="Steps" value={metrics.steps} />
      </div>
      {llm ? (
        <div className="llm-usage" aria-label="LLM usage">
          <strong>LLM usage</strong>
          <ul className="inline-list">
            <li>Model: {llm.model ?? 'n/a'}</li>
            <li>Calls: {llm.calls}</li>
            {llm.errors > 0 && <li>Errors: {llm.errors}</li>}
            <li>Prompt tokens: {formatNumber(llm.prompt_tokens)}</li>
            <li>Completion tokens: {formatNumber(llm.completion_tokens)}</li>
            <li>Total tokens: {formatNumber(llm.total_tokens)}</li>
            <li>LLM latency: {formatDuration(llm.latency_ms)}</li>
            {llm.estimated_cost_usd !== null && (
              <li>Estimated cost: {formatUsd(llm.estimated_cost_usd)}</li>
            )}
          </ul>
          {!llm.usage_reported_by_provider && <p className="muted small">Usage not reported by provider.</p>}
        </div>
      ) : (
        <p className="muted small" data-testid="no-llm">
          {mode === 'demo' ? 'No LLM calls (demo mode).' : 'No LLM usage recorded for this run.'}
        </p>
      )}
    </section>
  );
}

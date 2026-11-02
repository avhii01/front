import { formatDateTime } from '../format';
import type { RunBrief, RunDetail } from '../types';
import { InlineError } from './States';
import { StatusChip } from './StatusChip';

export type Busy = null | 'start-auto' | 'start-step' | 'step' | 'resume' | 'decide' | 'trace';

interface Props {
  runs: RunBrief[];
  run: RunDetail | null;
  /** True when any run for this order is pending/running/paused/awaiting approval. */
  hasActiveRun: boolean;
  busy: Busy;
  notice: string | null;
  error: string | null;
  onStartAuto: () => void;
  onStartStep: () => void;
  onNextStep: () => void;
  onResume: () => void;
  onSelectRun: (id: string) => void;
  onDownloadTrace: () => void;
}

export function RunControls(p: Props) {
  const working = p.busy !== null;
  const paused = p.run?.status === 'paused';
  const inProgress = p.run?.status === 'pending' || p.run?.status === 'running';
  return (
    <section className="panel" aria-labelledby="controls-title">
      <h2 id="controls-title" className="panel__title">
        Recovery run
      </h2>
      <div className="controls">
        <button
          type="button"
          className="btn btn--primary"
          onClick={p.onStartAuto}
          disabled={working || p.hasActiveRun}
          aria-label="Run recovery automatically"
          title={p.hasActiveRun ? 'A run is already active for this order' : undefined}
        >
          {p.busy === 'start-auto' ? 'Starting…' : 'Run recovery'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={p.onStartStep}
          disabled={working || p.hasActiveRun}
          aria-label="Start a step-by-step recovery run (created paused)"
          title={p.hasActiveRun ? 'A run is already active for this order' : undefined}
        >
          {p.busy === 'start-step' ? 'Creating…' : 'Step-by-step'}
        </button>
        <span className="controls__sep" aria-hidden="true" />
        <button
          type="button"
          className="btn"
          onClick={p.onNextStep}
          disabled={working || !paused}
          aria-label="Execute the next graph step"
        >
          {p.busy === 'step' ? 'Stepping…' : 'Next step'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={p.onResume}
          disabled={working || !paused}
          aria-label="Run the paused run to completion"
        >
          {p.busy === 'resume' ? 'Resuming…' : 'Run to completion'}
        </button>
      </div>
      {p.notice && (
        <p className="notice" role="status">
          {p.notice}
        </p>
      )}
      {p.error && <InlineError message={p.error} />}
      {inProgress && (
        <p className="muted small" role="status">
          <span className="spinner" aria-hidden="true" /> Run in progress; updating every second…
        </p>
      )}
      {p.run?.status === 'awaiting_approval' && (
        <p className="notice" role="status">
          This run is waiting for a human approval decision (see the approval panel below).
        </p>
      )}
      {paused && p.run && (
        <p className="muted small">
          Step mode: paused before node <code>{p.run.next_node ?? 'unknown'}</code>. {p.run.steps} step(s) executed so far.
        </p>
      )}

      <div className="run-head">
        {p.runs.length > 1 && (
          <label className="field field--inline">
            <span className="field__label">Run</span>
            <select value={p.run?.id ?? ''} onChange={(e) => p.onSelectRun(e.target.value)} aria-label="Select run">
              {p.runs.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i === 0 ? 'Latest · ' : ''}
                  {r.id.slice(0, 8)} · {r.status} · {formatDateTime(r.created_at)}
                </option>
              ))}
            </select>
          </label>
        )}
        {p.run && (
          <>
            <span className="run-head__id">
              Run <code>{p.run.id}</code>
            </span>
            <StatusChip kind="run" status={p.run.status} />
            <span className="badge" title="How this run decides what to do">
              {p.run.mode_label}
            </span>
            <button
              type="button"
              className="btn btn--small"
              onClick={p.onDownloadTrace}
              disabled={p.busy === 'trace'}
              aria-label="Download JSON trace for this run"
            >
              {p.busy === 'trace' ? 'Downloading…' : 'Download JSON trace'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

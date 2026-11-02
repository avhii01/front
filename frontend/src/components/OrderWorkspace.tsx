import { useEffect, useRef, useState } from 'react';
import { decideApproval, downloadTrace, errorMessage, getOrder, getRun, resumeRun, startRun, stepRun } from '../api';
import { humanize } from '../format';
import { usePolling } from '../hooks';
import type { Decision, RunStatus } from '../types';
import { ACTIVE_RUN_STATUSES } from '../types';
import { ApprovalPanel } from './ApprovalPanel';
import { DecisionsList } from './DecisionsList';
import { MetricsStrip } from './MetricsStrip';
import { OrderSummary } from './OrderSummary';
import { OutcomeBanner } from './OutcomeBanner';
import { type Busy, RunControls } from './RunControls';
import { ServiceCards } from './ServiceCards';
import { EmptyState, ErrorState, InlineError, Skeleton } from './States';
import { ToolTimeline } from './ToolTimeline';
import { VerificationPanel } from './VerificationPanel';

const ORDER_POLL_MS = 3000;

/** Poll fast while the worker is actually executing; slowly while waiting on a human or a step click. */
function runPollInterval(status: RunStatus | null): number | null {
  if (status === 'pending' || status === 'running') return 1000;
  if (status === 'paused' || status === 'awaiting_approval') return 1500;
  return null;
}

interface Props {
  orderId: string;
  /** Called after anything that changes order/run state so the queue can refresh. */
  onChanged: () => void;
}

export function OrderWorkspace({ orderId, onChanged }: Props) {
  const detail = usePolling(() => getOrder(orderId), orderId, ORDER_POLL_MS);
  const [runChoice, setRunChoice] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runs = detail.data?.runs ?? [];
  const selectedRunId = runChoice ?? runs[0]?.id ?? null;
  const run = usePolling(() => getRun(selectedRunId as string), selectedRunId, runPollInterval(runStatus));
  const runData = run.data && run.data.id === selectedRunId ? run.data : null;
  const hasActiveRun = runs.some((r) => ACTIVE_RUN_STATUSES.includes(r.status));

  // Keep the polling interval in sync with the run's status.
  const status = runData?.status ?? null;
  useEffect(() => setRunStatus(status), [status]);

  // When a run changes state, refresh the order (services, approvals) and the queue.
  const prevStatus = useRef<RunStatus | null>(null);
  useEffect(() => {
    if (prevStatus.current !== null && status !== prevStatus.current) {
      void detail.refresh();
      onChanged();
    }
    prevStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function act(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const refreshAll = async () => {
    await Promise.all([detail.refresh(), run.refresh()]);
    onChanged();
  };

  const start = (stepMode: boolean) =>
    act(stepMode ? 'start-step' : 'start-auto', async () => {
      const res = await startRun(orderId, stepMode);
      setRunChoice(res.run.id);
      if (res.already_active) {
        setNotice(`A run is already active for this order (${humanize(res.run.status)}). Showing it instead of starting a new one.`);
      }
      await refreshAll();
    });

  const nextStep = () =>
    act('step', async () => {
      if (!runData) return;
      const updated = await stepRun(runData.id);
      run.setData(updated);
      await detail.refresh();
      onChanged();
    });

  const resume = () =>
    act('resume', async () => {
      if (!runData) return;
      await resumeRun(runData.id);
      await refreshAll();
    });

  const trace = () =>
    act('trace', async () => {
      if (!runData) return;
      await downloadTrace(runData.id);
    });

  const onDecide = async (approvalId: string, decision: Decision, by: string, note?: string) => {
    const res = await decideApproval(approvalId, decision, by, note);
    await refreshAll();
    return res;
  };

  if (detail.loading && !detail.data) return <Skeleton lines={8} label="Loading order" />;
  if (!detail.data) {
    return <ErrorState title="Could not load order" message={detail.error ?? 'Unknown error'} onRetry={() => void detail.refresh()} />;
  }
  const { order, services, approvals } = detail.data;

  return (
    <div className="workspace">
      {detail.error && <InlineError message={`Order refresh failed: ${detail.error}. Showing last known data.`} />}
      <OrderSummary order={order} />
      <ServiceCards services={services} />
      <RunControls
        runs={runs}
        run={runData}
        hasActiveRun={hasActiveRun}
        busy={busy}
        notice={notice}
        error={actionError}
        onStartAuto={() => void start(false)}
        onStartStep={() => void start(true)}
        onNextStep={() => void nextStep()}
        onResume={() => void resume()}
        onSelectRun={(id) => setRunChoice(id)}
        onDownloadTrace={() => void trace()}
      />

      {selectedRunId === null ? (
        <EmptyState title="No run yet">
          Start “Run recovery” to let the agent investigate and repair this order, or “Step-by-step” to advance it one node at a time.
        </EmptyState>
      ) : !runData ? (
        run.error ? (
          <ErrorState title="Could not load run" message={run.error} onRetry={() => void run.refresh()} />
        ) : (
          <Skeleton lines={6} label="Loading run" />
        )
      ) : (
        <>
          {run.error && <InlineError message={`Run refresh failed: ${run.error}. Showing last known data.`} />}
          <OutcomeBanner run={runData} />
          <MetricsStrip metrics={runData.metrics} mode={runData.mode} />
          {(runData.approvals.length > 0 || runData.status === 'awaiting_approval') && (
            <ApprovalPanel approvals={runData.approvals.length > 0 ? runData.approvals : approvals} runStatus={runData.status} onDecide={onDecide} />
          )}
          <div className="grid grid--2">
            <DecisionsList decisions={runData.decisions} mode={runData.mode} />
            <ToolTimeline calls={runData.tool_calls} />
          </div>
          <VerificationPanel verification={runData.verification} />
        </>
      )}
    </div>
  );
}

import type { Verification } from '../types';
import { prettyJson } from '../format';
import { EmptyState } from './States';

export function VerificationPanel({ verification }: { verification: Verification | null }) {
  return (
    <section className="panel" aria-labelledby="verification-title">
      <h2 id="verification-title" className="panel__title">
        Final verification
      </h2>
      {!verification ? (
        <EmptyState title="Not verified yet">Independent checks run against the services once the agent finishes.</EmptyState>
      ) : (
        <>
          <p>
            <span className={`badge ${verification.passed ? 'badge--allowed' : 'badge--denied'}`}>
              {verification.passed ? '✓ All checks passed' : '✗ Verification failed'}
            </span>
            {verification.expectation && <span className="muted small"> expected outcome: {verification.expectation}</span>}
          </p>
          {verification.error !== undefined && verification.error !== null && (
            <p className="inline-error" role="alert">
              Verification error: {typeof verification.error === 'string' ? verification.error : prettyJson(verification.error)}
            </p>
          )}
          {verification.checks.length === 0 ? (
            <p className="muted small">No individual checks were recorded.</p>
          ) : (
            <ul className="checks">
              {verification.checks.map((c) => (
                <li key={c.id} className={c.passed ? 'check is-pass' : 'check is-fail'}>
                  <span className="check__mark" aria-hidden="true">
                    {c.passed ? '✓' : '✗'}
                  </span>
                  <div>
                    <div>
                      <span className="visually-hidden">{c.passed ? 'Passed: ' : 'Failed: '}</span>
                      <strong>{c.description}</strong> <span className="tag">{c.passed ? 'PASS' : 'FAIL'}</span>
                    </div>
                    {c.detail && <div className="muted small">{c.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

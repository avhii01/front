import { useState } from 'react';
import { errorMessage, getScenarios, injectScenario } from '../api';
import { usePolling } from '../hooks';
import type { Order } from '../types';
import { InlineError, Skeleton } from './States';

interface Props {
  onInjected: (order: Order) => void;
}

const fetchScenarios = () => getScenarios();

export function ScenarioInjector({ onInjected }: Props) {
  const { data: scenarios, error, loading, refresh } = usePolling(fetchScenarios, 'scenarios', null);
  const [scenarioKey, setScenarioKey] = useState('');
  const [variantKey, setVariantKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [injectError, setInjectError] = useState<string | null>(null);

  const scenario = scenarios?.find((s) => s.key === scenarioKey) ?? scenarios?.[0];
  const effectiveVariant = scenario
    ? scenario.variants.some((v) => v.key === variantKey)
      ? variantKey
      : scenario.default_variant
    : '';
  const variant = scenario?.variants.find((v) => v.key === effectiveVariant);

  async function inject() {
    if (!scenario) return;
    setBusy(true);
    setInjectError(null);
    try {
      const order = await injectScenario(scenario.key, effectiveVariant);
      onInjected(order);
    } catch (e) {
      setInjectError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="inject-title">
      <h2 id="inject-title" className="panel__title">
        Inject a failure
      </h2>
      {loading && <Skeleton lines={3} label="Loading scenarios" />}
      {!loading && !scenarios && (
        <div className="state state--error" role="alert">
          <p>Could not load scenarios: {error}</p>
          <button type="button" className="btn btn--small" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {scenario && scenarios && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void inject();
          }}
        >
          <label className="field">
            <span className="field__label">Scenario</span>
            <select
              value={scenario.key}
              onChange={(e) => {
                setScenarioKey(e.target.value);
                setVariantKey('');
              }}
              disabled={busy}
            >
              {scenarios.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <p className="field__help">{scenario.description}</p>
          <label className="field">
            <span className="field__label">Variant</span>
            <select value={effectiveVariant} onChange={(e) => setVariantKey(e.target.value)} disabled={busy}>
              {scenario.variants.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.key}
                  {v.key === scenario.default_variant ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          {variant && <p className="field__help">{variant.description}</p>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Injecting…' : 'Inject failure'}
          </button>
          {injectError && <InlineError message={injectError} />}
        </form>
      )}
    </section>
  );
}

import { prettyJson } from '../format';

interface Props {
  label: string;
  value: unknown;
  /** Open by default. */
  open?: boolean;
}

/** Collapsible, formatted JSON. Content is rendered as text (never HTML). */
export function JsonBlock({ label, value, open }: Props) {
  const empty = value === null || value === undefined || (typeof value === 'object' && Object.keys(value as object).length === 0);
  return (
    <details className="json" open={open}>
      <summary>{label}</summary>
      {empty ? <p className="muted small">None</p> : <pre className="json__pre">{prettyJson(value)}</pre>}
    </details>
  );
}

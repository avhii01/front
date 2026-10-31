import { humanize } from '../format';

export type ChipKind = 'order' | 'run' | 'outcome' | 'tool' | 'ticket';
export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'escalate' | 'neutral';

const TONES: Record<ChipKind, Record<string, Tone>> = {
  order: { pending: 'warn', paid: 'info', reserved: 'info', shipped: 'ok', refunded: 'ok' },
  run: {
    pending: 'neutral',
    running: 'info',
    paused: 'warn',
    awaiting_approval: 'warn',
    succeeded: 'ok',
    escalated: 'escalate',
    failed: 'bad',
  },
  outcome: { fulfilled: 'ok', refunded: 'ok', escalated: 'escalate', failed: 'bad' },
  tool: { ok: 'ok', error: 'bad', ambiguous: 'warn', replayed: 'info' },
  ticket: {
    awaiting: 'neutral',
    blank: 'neutral',
    new: 'neutral',
    new_ticket: 'neutral',
    investigating: 'info',
    recovering: 'info',
    working: 'info',
    on_hold: 'warn',
    hold: 'warn',
    awaiting_approval: 'warn',
    awaiting_caller: 'warn',
    waiting_for_caller_confirmation: 'warn',
    resolved: 'ok',
    resolve: 'ok',
    escalated: 'escalate',
    open: 'neutral',
  },
};

// Glyphs make status readable without relying on colour alone.
const GLYPHS: Record<Tone, string> = { ok: '✓', bad: '✗', warn: '!', info: '●', escalate: '↑', neutral: '○' };

export function toneFor(kind: ChipKind, status: string): Tone {
  return TONES[kind][status] ?? 'neutral';
}

interface Props {
  status: string;
  kind?: ChipKind;
  label?: string;
}

export function StatusChip({ status, kind = 'run', label }: Props) {
  const tone = toneFor(kind, status);
  const text = label ?? humanize(status);
  return (
    <span className={`chip chip--${tone}`} data-tone={tone} data-status={status}>
      <span className="chip__glyph" aria-hidden="true">
        {GLYPHS[tone]}
      </span>
      {text}
    </span>
  );
}

export interface OperationalStatus {
  raw: string;
  display: 'Awaiting' | 'Working' | 'Hold' | 'Resolve' | 'Waiting for caller confirmation' | 'Escalated' | string;
  label: string;
  tone: Tone;
  daysOnHold?: number;
}

export function getOperationalTicketStatus(
  status: string,
  updatedAt?: string | null,
  operatorStatus?: string | null,
): OperationalStatus {
  const norm = (operatorStatus || status || '').toLowerCase().trim();

  if (!norm || norm === 'awaiting' || norm === 'blank' || norm === 'new' || norm === 'new_ticket' || norm === 'new ticket') {
    return { raw: 'awaiting', display: 'New Ticket', label: 'New Ticket', tone: 'neutral' };
  }

  if (norm === 'resolved' || norm === 'resolve') {
    return { raw: 'resolved', display: 'Resolve', label: 'Resolved', tone: 'ok' };
  }

  if (norm === 'awaiting_caller' || norm === 'waiting_for_caller_confirmation' || norm === 'waiting for caller') {
    return {
      raw: 'awaiting_caller',
      display: 'Waiting for caller confirmation',
      label: 'Waiting for Caller',
      tone: 'warn',
    };
  }

  if (norm === 'on_hold' || norm === 'awaiting_approval' || norm === 'hold') {
    let days = 0;
    if (updatedAt) {
      const diffMs = Date.now() - new Date(updatedAt).getTime();
      days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
    if (days >= 3) {
      return { raw: 'escalated', display: 'Escalated', label: `Escalated (On hold > 3 days)`, tone: 'escalate', daysOnHold: days };
    }
    return { raw: 'on_hold', display: 'Hold', label: 'Hold', tone: 'warn', daysOnHold: days };
  }

  if (norm === 'escalated') {
    return { raw: 'escalated', display: 'Escalated', label: 'Escalated', tone: 'escalate' };
  }

  if (norm === 'working') {
    return { raw: 'working', display: 'Working', label: 'Working', tone: 'info' };
  }

  return { raw: 'awaiting', display: 'New Ticket', label: 'New Ticket', tone: 'neutral' };
}

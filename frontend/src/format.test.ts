import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, formatUsd, parseApiDate } from './format';

describe('formatMoney', () => {
  it('formats integer cents as currency', () => {
    expect(formatMoney(129900, 'USD')).toBe('$1,299.00');
    expect(formatMoney(4999, 'USD')).toBe('$49.99');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('respects the currency code', () => {
    expect(formatMoney(4999, 'EUR')).toBe('€49.99');
  });

  it('returns a placeholder for missing values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
});

describe('formatDuration / formatUsd / parseApiDate', () => {
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(250)).toBe('250 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
    expect(formatDuration(125000)).toBe('2 min 5 s');
  });

  it('keeps precision for tiny LLM costs', () => {
    expect(formatUsd(0.000123)).toBe('$0.000123');
    expect(formatUsd(1.5)).toBe('$1.50');
  });

  it('treats zone-less timestamps as UTC', () => {
    expect(parseApiDate('2026-01-01T10:00:00')?.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(parseApiDate('nope')).toBeNull();
  });
});

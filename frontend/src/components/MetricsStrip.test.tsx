import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunMetrics } from '../types';
import { MetricsStrip } from './MetricsStrip';

const base: RunMetrics = { active_ms: 1500, wall_ms: 2500, tool_calls: 7, steps: 9, llm: null };

describe('MetricsStrip', () => {
  it('says there are no LLM calls in demo mode', () => {
    render(<MetricsStrip metrics={base} mode="demo" />);
    expect(screen.getByText('No LLM calls (demo mode).')).toBeTruthy();
    expect(screen.queryByLabelText('LLM usage')).toBeNull();
    expect(screen.getByText('1.50 s')).toBeTruthy();
  });

  it('shows LLM usage only when present, and flags unreported usage', () => {
    const llm = {
      calls: 3,
      errors: 0,
      model: 'gpt-4o-mini',
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      latency_ms: 800,
      estimated_cost_usd: null,
      usage_reported_by_provider: false,
    };
    render(<MetricsStrip metrics={{ ...base, llm }} mode="llm" />);
    expect(screen.getByLabelText('LLM usage')).toBeTruthy();
    expect(screen.getByText(/Calls: 3/)).toBeTruthy();
    expect(screen.getByText(/usage not reported by provider/i)).toBeTruthy();
  });
});

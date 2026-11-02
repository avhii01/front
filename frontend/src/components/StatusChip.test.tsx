import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip, toneFor } from './StatusChip';

describe('StatusChip', () => {
  it('renders a readable label (not colour alone) and a tone', () => {
    render(<StatusChip kind="run" status="awaiting_approval" />);
    const chip = screen.getByText('Awaiting approval');
    expect(chip.getAttribute('data-tone')).toBe('warn');
    expect(chip.textContent).toContain('!'); // glyph accompanies the colour
  });

  it('maps statuses to tones per kind', () => {
    expect(toneFor('run', 'succeeded')).toBe('ok');
    expect(toneFor('run', 'failed')).toBe('bad');
    expect(toneFor('outcome', 'escalated')).toBe('escalate');
    expect(toneFor('tool', 'ambiguous')).toBe('warn');
    expect(toneFor('order', 'something_new')).toBe('neutral');
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isPageReload } from './session';

describe('isPageReload and session tab-close isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects reload when navigation entry type is reload', () => {
    vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ]);
    expect(isPageReload()).toBe(true);
  });

  it('detects fresh tab / navigation when navigation entry type is navigate', () => {
    vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
      { type: 'navigate' } as PerformanceNavigationTiming,
    ]);
    expect(isPageReload()).toBe(false);
  });

  it('detects restored closed tab when navigation entry type is back_forward or other non-reload type', () => {
    vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
      { type: 'back_forward' } as PerformanceNavigationTiming,
    ]);
    expect(isPageReload()).toBe(false);
  });
});

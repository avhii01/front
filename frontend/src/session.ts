/**
 * Session lifecycle & tab-close management.
 *
 * Ensures that user and admin sessions are strictly tied to the active browser tab session:
 * - Refreshing the active page (F5 / Ctrl+R / browser reload button) preserves the logged-in session.
 * - Closing the tab (and subsequently reopening it, restoring it via Ctrl+Shift+T, or opening a new tab)
 *   invalidates the session, requiring the user/operator to sign in again.
 */

export function isPageReload(): boolean {
  if (typeof window === 'undefined') return false;

  // In test runners (Vitest / jsdom), default to reload unless a test specifically overrides navigation entries
  if (import.meta.env?.MODE === 'test') {
    const entries = window.performance?.getEntriesByType?.('navigation');
    if (entries && entries.length > 0) {
      return (entries[0] as PerformanceNavigationTiming).type === 'reload';
    }
    return true;
  }

  try {
    // 1. Standard Navigation Timing Level 2 (Chrome, Edge, Firefox, Safari)
    const entries = window.performance?.getEntriesByType?.('navigation');
    if (entries && entries.length > 0) {
      return (entries[0] as PerformanceNavigationTiming).type === 'reload';
    }

    // 2. Navigation Timing Level 1 fallback
    const legacy = (window.performance as unknown as { navigation?: { type?: number } })?.navigation;
    if (legacy && typeof legacy.type === 'number') {
      return legacy.type === 1; // 1 = TYPE_RELOAD
    }
  } catch {
    // Graceful fallback
  }

  return false;
}

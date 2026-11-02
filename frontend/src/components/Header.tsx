import { useEffect, useRef, useState } from 'react';
import type { AppConfig } from '../types';
import type { AdminUser } from './SettingsModal';

interface Props {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSignOut?: () => void;
  currentUser?: AdminUser;
  onOpenSettings?: (tab?: 'profile' | 'personal' | 'team' | 'policies' | 'actions') => void;
  onNavigateView?: (view: 'orders' | 'tickets') => void;
  onOpenHealthModal?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  authenticated?: boolean;
}

export function modeBadgeText(config: AppConfig): string {
  return config.mode === 'llm'
    ? `LLM mode: ${config.model ?? 'unknown model'}`
    : 'Deterministic demo mode (rule-based, no LLM)';
}

export function Header({
  config,
  loading,
  error,
  onRetry,
  onSignOut,
  currentUser,
  onOpenSettings,
  onNavigateView,
  onOpenHealthModal,
  searchQuery = '',
  onSearchChange,
  authenticated = Boolean(currentUser),
}: Props) {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLauncherOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setIsLauncherOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLauncherOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLauncherOpen]);

  const userInitials = (currentUser?.name || 'Operator')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

  const userId = currentUser?.id || 'ADM-9041';
  const userName = currentUser?.name || 'Admin Operator';

  return (
    <>
      <div className="google-color-stripe" aria-hidden="true" />
      <header className="app-header google-header">
        <div className="google-header__left" style={{ position: 'relative' }} ref={launcherRef}>
          {/* Interactive 6-Dot Google Cloud App Launcher Button - only visible when signed in */}
          {authenticated && (
            <button
              type="button"
              className={`google-waffle-btn ${isLauncherOpen ? 'is-active' : ''}`}
              onClick={() => setIsLauncherOpen(!isLauncherOpen)}
              title="Google Services & Relay Apps"
              aria-label="Open Relay Apps Menu"
              aria-expanded={isLauncherOpen}
            >
              <span className="google-waffle__dot"></span>
              <span className="google-waffle__dot"></span>
              <span className="google-waffle__dot"></span>
              <span className="google-waffle__dot"></span>
              <span className="google-waffle__dot"></span>
              <span className="google-waffle__dot"></span>
            </button>
          )}

          {/* Google Services & Relay Apps Popover */}
          {authenticated && isLauncherOpen && (
            <div className="google-app-launcher-popover" role="menu" aria-label="Relay and Google Cloud apps">
              <div className="google-launcher-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>☁️</span>
                  <strong>Relay Operations Apps</strong>
                </div>
                <span className="google-project-pill" style={{ margin: 0 }}>
                  <span className="google-dot-green"></span> prod-ops
                </span>
              </div>

              <div className="google-launcher-grid">
                {/* 1. Orders & Recovery */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onNavigateView?.('orders');
                    setIsLauncherOpen(false);
                  }}
                  title="Switch to Orders & Recovery Console"
                >
                  <div className="google-launcher-icon" style={{ background: '#e8f0fe', color: '#1a73e8' }}>
                    📦
                  </div>
                  <span className="google-launcher-name">Orders</span>
                  <span className="google-launcher-desc">Reconciliation</span>
                </button>

                {/* 2. Support Tickets */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onNavigateView?.('tickets');
                    setIsLauncherOpen(false);
                  }}
                  title="Switch to Support Tickets View"
                >
                  <div className="google-launcher-icon" style={{ background: '#fef7e0', color: '#f29900' }}>
                    🎫
                  </div>
                  <span className="google-launcher-name">Tickets</span>
                  <span className="google-launcher-desc">Case Queue</span>
                </button>

                {/* 3. Customer Portal */}
                <a
                  role="menuitem"
                  href="/support"
                  target="_blank"
                  rel="noreferrer"
                  className="google-launcher-tile"
                  onClick={() => setIsLauncherOpen(false)}
                  title="Open Customer Support Chat Interface in new tab"
                >
                  <div className="google-launcher-icon" style={{ background: '#e6f4ea', color: '#1e8e3e' }}>
                    💬
                  </div>
                  <span className="google-launcher-name">Customer Chat</span>
                  <span className="google-launcher-desc">Support Portal ↗</span>
                </a>

                {/* 4. Failure Simulator */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onNavigateView?.('orders');
                    setIsLauncherOpen(false);
                    const el = document.getElementById('scenario-injector');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  title="Inject test failure scenarios"
                >
                  <div className="google-launcher-icon" style={{ background: '#f3e8fd', color: '#9334e6' }}>
                    🧪
                  </div>
                  <span className="google-launcher-name">Simulator</span>
                  <span className="google-launcher-desc">Failure Scenarios</span>
                </button>

                {/* 5. Policy Engine */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onOpenSettings?.('policies');
                    setIsLauncherOpen(false);
                  }}
                  title="Open Policy Engine & Rules Matrix"
                >
                  <div className="google-launcher-icon" style={{ background: '#e8eaf6', color: '#3f51b5' }}>
                    📜
                  </div>
                  <span className="google-launcher-name">Policies</span>
                  <span className="google-launcher-desc">Fixed Rule Engine</span>
                </button>

                {/* 6. Service Mesh Health */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onOpenHealthModal?.();
                    setIsLauncherOpen(false);
                  }}
                  title="Inspect microservices, queue depths & architecture hierarchy"
                >
                  <div className="google-launcher-icon" style={{ background: '#e0f2f1', color: '#00897b' }}>
                    📡
                  </div>
                  <span className="google-launcher-name">Services</span>
                  <span className="google-launcher-desc">Service Mesh</span>
                </button>

                {/* 7. Audit Activity Trail */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onOpenSettings?.('actions');
                    setIsLauncherOpen(false);
                  }}
                  title="View your session actions and audit logs"
                >
                  <div className="google-launcher-icon" style={{ background: '#eceff1', color: '#455a64' }}>
                    📋
                  </div>
                  <span className="google-launcher-name">Audit Log</span>
                  <span className="google-launcher-desc">Session History</span>
                </button>

                {/* 8. Personal Settings */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onOpenSettings?.('personal');
                    setIsLauncherOpen(false);
                  }}
                  title="Change Password, Display Name & Preferences"
                >
                  <div className="google-launcher-icon" style={{ background: '#f5f5f5', color: '#616161' }}>
                    ⚙️
                  </div>
                  <span className="google-launcher-name">Settings</span>
                  <span className="google-launcher-desc">Password &amp; User</span>
                </button>

                {/* 9. Support Team & Specialists (Replaces API Docs) */}
                <button
                  type="button"
                  role="menuitem"
                  className="google-launcher-tile"
                  onClick={() => {
                    onOpenSettings?.('team');
                    setIsLauncherOpen(false);
                  }}
                  title="Manage Support Team Specialists, assignments & Team Logs"
                >
                  <div className="google-launcher-icon" style={{ background: '#fce8e6', color: '#c5221f' }}>
                    👥
                  </div>
                  <span className="google-launcher-name">Support Team</span>
                  <span className="google-launcher-desc">Specialists &amp; Logs</span>
                </button>
              </div>

              <div className="google-launcher-footer">
                <span>Logged in: <strong>{userName}</strong> ({userId})</span>
                <span className="muted small">Press Esc to close</span>
              </div>
            </div>
          )}

          <div className="app-header__title google-brand">
            <div className="google-cloud-badge" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#4285F4"/>
                <path d="M12 18l4-4h-3V9h-2v5H8l4 4z" fill="#FFFFFF"/>
              </svg>
            </div>
            <h1>Relay</h1>
            <span className="app-header__subtitle">AI Order Recovery Agent · Operations</span>
          </div>
        </div>

        {/* Central interactive search bar - only available when authenticated and search handler provided */}
        {authenticated && onSearchChange && (
          <div className="google-search-bar" role="search">
            <span className="google-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search resources, orders, and tickets..."
              className="google-search-input-header"
              aria-label="Search resources, orders, and tickets"
            />
            <kbd className="google-search-shortcut" aria-hidden="true">/</kbd>
          </div>
        )}

        {/* Accessible for screen readers and unit tests, kept visually out of header */}
        <div className="sr-only">
          {config ? (
            <span
              className={`badge badge--mode badge--mode-${config.mode}`}
              role="status"
              aria-label={`Agent mode: ${modeBadgeText(config)}`}
              data-mode={config.mode}
            >
              {modeBadgeText(config)}
            </span>
          ) : error ? (
            <span className="badge badge--mode badge--mode-error" role="alert">
              Mode unknown: {error}
              <button type="button" className="btn btn--small" onClick={onRetry}>
                Retry
              </button>
            </span>
          ) : (
            <span className="badge badge--mode" role="status" aria-busy={loading}>
              Loading mode…
            </span>
          )}
          <span className="badge badge--simulated">
            SIMULATED services
          </span>
        </div>

        {/* Right Navigation: Operator Profile Pill with ID, Settings Button, Sign Out Button */}
        <div className="google-header__right">
          {authenticated && currentUser && onOpenSettings && (
            <button
              type="button"
              className="google-operator-pill"
              onClick={() => onOpenSettings('profile')}
              title={`Logged in as ${userName} (${userId}) · Click to open settings`}
              aria-label={`Operator profile: ${userName}, ID ${userId}. Click to open settings.`}
            >
              <div className="google-user-avatar" aria-hidden="true">
                {userInitials}
              </div>
              <div className="google-operator-text">
                <span className="google-operator-name">{userName}</span>
                <span className="google-operator-id">ID: <code>{userId}</code></span>
              </div>
            </button>
          )}

          {authenticated && currentUser && onOpenSettings && (
            <button
              type="button"
              className="btn btn--sm google-btn-settings"
              onClick={() => onOpenSettings('personal')}
              title="Open Personal & Operator Settings"
              aria-label="Open Settings"
            >
              ⚙️ Settings
            </button>
          )}

          {authenticated && onSignOut && (
            <button
              type="button"
              className="btn btn--ghost btn--sm google-btn-signout"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              Sign out
            </button>
          )}
        </div>

        {authenticated && config && (
          <p className="app-header__note google-header__note">
            {config.mode === 'llm'
              ? 'A language model proposes each next action; a deterministic policy engine validates every one before it runs.'
              : 'Recovery decisions come from fixed rules and a deterministic policy engine. No language model is involved.'}
          </p>
        )}
      </header>
    </>
  );
}

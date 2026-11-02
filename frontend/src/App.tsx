import { useMemo, useState } from 'react';
import { API_URL, adminSignIn, errorMessage, getConfig, listOrders, listTickets } from './api';
import { Header } from './components/Header';
import { OrderQueue } from './components/OrderQueue';
import { OrderWorkspace } from './components/OrderWorkspace';
import { ScenarioInjector } from './components/ScenarioInjector';
import { ServiceHealthModal } from './components/ServiceHealthModal';
import { SettingsModal, type AdminUser, type OperatorAction } from './components/SettingsModal';
import { EmptyState, InlineError } from './components/States';
import SupportApp from './components/SupportApp';
import { TicketQueue } from './components/TicketQueue';
import { TicketWorkspace } from './components/TicketWorkspace';
import { usePolling } from './hooks';
import type { Order, TicketListItem } from './types';

const ORDERS_POLL_MS = 3000;
const TICKETS_POLL_MS = 3000;

type View = 'orders' | 'tickets';

function isSupportPath(): boolean {
  return window.location.pathname.replace(/\/+$/, '').toLowerCase().endsWith('/support');
}

const ADMIN_TOKEN_KEY = 'relay.admin.token';
const ADMIN_USER_KEY = 'relay.admin.user';
const ADMIN_ACTIONS_KEY = 'relay.admin.actions';

function readStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function readStoredAdminUser(): AdminUser {
  try {
    const raw = sessionStorage.getItem(ADMIN_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    id: 'ADM-9041',
    email: 'admin@relay.test',
    name: 'Admin Operator',
    role: 'Lead Recovery Specialist & Operations Admin',
    department: 'Customer Operations & Logistics Reliability',
    loginTime: new Date().toISOString(),
  };
}

function persistAdminSession(token: string | null, user?: AdminUser | null) {
  try {
    if (!token) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_USER_KEY);
    } else {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      if (user) sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    }
  } catch {
    // sessionStorage unavailable
  }
}

function readStoredActions(): OperatorAction[] {
  try {
    const raw = sessionStorage.getItem(ADMIN_ACTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [
    {
      id: 'act-init-1',
      timestamp: new Date().toISOString(),
      category: 'Auth',
      description: 'Signed in to Relay Operations Console via secure administrator session.',
    },
    {
      id: 'act-init-2',
      timestamp: new Date().toISOString(),
      category: 'Ticket',
      description: 'Loaded customer support ticket queue and verified active service records.',
    },
  ];
}

interface AdminSignInViewProps {
  onSignedIn: (token: string, admin?: AdminUser) => void;
}

function AdminSignInView({ onSignedIn }: AdminSignInViewProps) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const config = usePolling(getConfig, 'config', null);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminBusy(true);
    setAdminError(null);
    try {
      const res = await adminSignIn(adminEmail, adminPassword);
      const adminUser: AdminUser = {
        id: res.admin?.id || 'ADM-9041',
        email: res.admin?.email || adminEmail,
        name: res.admin?.name || 'Admin Operator',
        role: res.admin?.role || 'Lead Recovery Specialist & Operations Admin',
        department: 'Customer Operations & Logistics Reliability',
        loginTime: new Date().toISOString(),
      };
      onSignedIn(res.token, adminUser);
    } catch (err) {
      setAdminError(errorMessage(err));
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <>
      <Header
        config={config.data}
        loading={config.loading}
        error={config.error}
        onRetry={() => void config.refresh()}
        authenticated={false}
      />
      <main className="support-shell">
        <section className="panel support-signin" aria-labelledby="admin-signin-title">
          <h2 id="admin-signin-title" className="panel__title">
            Operator Dashboard · Admin Sign In
          </h2>
          <p className="muted">
            Authentication required for operations access. Please sign in with your administrator credentials.
          </p>
          <form className="form" onSubmit={(e) => void handleAdminSignIn(e)}>
            <label className="field">
              <span className="field__label">Admin Email or ID</span>
              <input
                type="text"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoComplete="username"
                required
                placeholder="Enter admin email or ID"
              />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Enter password"
              />
            </label>
            <div className="controls">
              <button type="submit" className="btn btn--primary" disabled={adminBusy || !adminEmail.trim() || !adminPassword}>
                {adminBusy ? 'Signing in…' : 'Sign in as Admin'}
              </button>
            </div>
          </form>
          {adminError && <InlineError message={adminError} />}

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <span className="muted small">Looking for the customer support chat? </span>
            <a
              href="/support"
              style={{ fontWeight: 600, color: 'var(--accent, #1a73e8)', textDecoration: 'underline', fontSize: '0.88rem' }}
            >
              Go to Customer Login ↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}

function safeScrollToTop() {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.scrollTo === 'function' &&
      !navigator.userAgent.includes('jsdom')
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch {
    // jsdom or unsupported
  }
}

interface TicketDetailsPageProps {
  ticketId: string;
  allTickets: TicketListItem[];
  onBack: () => void;
  onSelectTicket: (id: string) => void;
  onOpenOrder: (orderId: string) => void;
  currentUser?: AdminUser;
}

function TicketDetailsPage({
  ticketId,
  allTickets,
  onBack,
  onSelectTicket,
  onOpenOrder,
  currentUser,
}: TicketDetailsPageProps) {
  const currentIndex = allTickets.findIndex((item) => item.ticket.id === ticketId);
  const prevTicket = currentIndex > 0 ? allTickets[currentIndex - 1] : null;
  const nextTicket = currentIndex >= 0 && currentIndex < allTickets.length - 1 ? allTickets[currentIndex + 1] : null;

  return (
    <div className="ticket-page-view" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Page Navigation Bar */}
      <div
        className="ticket-page-nav"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--surface)',
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onBack}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ← Back to Tickets List
          </button>
          <span className="muted small" style={{ fontSize: '0.9rem' }}>
            Support Ticket: <strong style={{ color: 'var(--primary, #0284c7)' }}>{ticketId}</strong>
            {currentIndex >= 0 && (
              <span className="badge" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>
                Ticket {currentIndex + 1} of {allTickets.length}
              </span>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!prevTicket}
            onClick={() => {
              if (prevTicket) {
                onSelectTicket(prevTicket.ticket.id);
                safeScrollToTop();
              }
            }}
            title={prevTicket ? `Previous ticket: ${prevTicket.ticket.id}` : 'No previous ticket'}
          >
            ▲ Prev Ticket
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!nextTicket}
            onClick={() => {
              if (nextTicket) {
                onSelectTicket(nextTicket.ticket.id);
                safeScrollToTop();
              }
            }}
            title={nextTicket ? `Next ticket: ${nextTicket.ticket.id}` : 'No next ticket'}
          >
            Next Ticket ▼
          </button>
        </div>
      </div>

      {/* Full Ticket Workspace starting right at the top */}
      <TicketWorkspace
        key={ticketId}
        ticketId={ticketId}
        onOpenOrder={onOpenOrder}
        onBack={onBack}
        currentUser={currentUser}
      />
    </div>
  );
}

interface OperationsDashboardProps {
  onSignOut: () => void;
  currentUser: AdminUser;
  onUpdateUser: (updated: Partial<AdminUser>) => void;
}

function OperationsDashboard({ onSignOut, currentUser, onUpdateUser }: OperationsDashboardProps) {
  const [view, setView] = useState<View>('orders');
  const config = usePolling(getConfig, 'config', null);
  const orders = usePolling(listOrders, 'orders', ORDERS_POLL_MS);
  const tickets = usePolling(listTickets, view === 'tickets' ? 'tickets' : null, TICKETS_POLL_MS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Settings, Health & Actions
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'personal' | 'team' | 'policies' | 'actions'>('profile');
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [actions, setActions] = useState<OperatorAction[]>(() => readStoredActions());
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenSettings = (tab?: 'profile' | 'personal' | 'team' | 'policies' | 'actions') => {
    if (tab) setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleNavigateView = (targetView: View) => {
    setView(targetView);
    setSelectedTicketId(null);
    safeScrollToTop();
    addAction('Auth', `Navigated to ${targetView === 'orders' ? 'Orders & Recovery' : 'Support Tickets Queue'}`);
  };

  const addAction = (category: OperatorAction['category'], description: string) => {
    const act: OperatorAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      category,
      description,
    };
    setActions((prev) => {
      const next = [act, ...prev].slice(0, 60);
      try {
        sessionStorage.setItem(ADMIN_ACTIONS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleUpdateUser = (updated: Partial<AdminUser>) => {
    onUpdateUser(updated);
    if (updated.name) {
      addAction('Settings', `Updated operator display name to "${updated.name}"`);
    }
  };

  const handleClearActions = () => {
    setActions([]);
    try {
      sessionStorage.removeItem(ADMIN_ACTIONS_KEY);
    } catch {
      // ignore
    }
  };

  const onInjected = (order: Order) => {
    setSelectedId(order.id);
    setView('orders');
    addAction('Order', `Injected failure scenario for order ${order.id} (${order.sku})`);
    void orders.refresh();
  };

  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    addAction('Ticket', `Opened support ticket details workspace for ${id}`);
    safeScrollToTop();
  };

  // Live matching resources from toolbar search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matchTickets = (tickets.data || []).filter((t) => {
      const idMatch = t.ticket.id.toLowerCase().includes(q);
      const custMatch = t.customer ? `${t.customer.name} ${t.customer.email}`.toLowerCase().includes(q) : false;
      const deptMatch = (t.department || '').toLowerCase().includes(q);
      const queryMatch = (t.query || t.ticket.confirmed_summary || t.ticket.summary || '').toLowerCase().includes(q);
      return idMatch || custMatch || deptMatch || queryMatch;
    }).slice(0, 5);

    const matchOrders = (orders.data || []).filter((o) => {
      const idMatch = o.id.toLowerCase().includes(q);
      const skuMatch = o.sku.toLowerCase().includes(q);
      const custMatch = o.customer_email ? o.customer_email.toLowerCase().includes(q) : false;
      return idMatch || skuMatch || custMatch;
    }).slice(0, 5);

    return { tickets: matchTickets, orders: matchOrders };
  }, [searchQuery, tickets.data, orders.data]);

  const pendingApprovalsCount = useMemo(() => {
    const fromTickets = (tickets.data || []).filter((t) => t.pending_approval_id != null).length;
    const fromOrders = (orders.data || []).filter((o) => o.pending_approval_id != null).length;
    return fromTickets + fromOrders;
  }, [tickets.data, orders.data]);

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to order workspace
      </a>
      <Header
        config={config.data}
        loading={config.loading}
        error={config.error}
        onRetry={() => void config.refresh()}
        onSignOut={onSignOut}
        currentUser={currentUser}
        onOpenSettings={handleOpenSettings}
        onNavigateView={handleNavigateView}
        onOpenHealthModal={() => setIsHealthOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        authenticated={true}
      />

      {/* Quick Search Flyout Dropdown */}
      {searchResults && (
        <div className="google-search-results-panel" role="region" aria-label="Search results">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)' }}>
              RESULTS FOR &quot;{searchQuery}&quot;
            </span>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '0.78rem', padding: '2px 6px' }}
            >
              Clear ✕
            </button>
          </div>

          {searchResults.tickets.length === 0 && searchResults.orders.length === 0 ? (
            <div className="muted small" style={{ padding: '12px 0', textAlign: 'center' }}>
              No matching tickets or orders found.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {searchResults.tickets.map((t) => (
                <button
                  key={t.ticket.id}
                  type="button"
                  className="google-search-result-item"
                  onClick={() => {
                    handleSelectTicket(t.ticket.id);
                    setView('tickets');
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, #e8eaed)',
                    background: 'var(--surface-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎫</span>
                    <strong style={{ color: 'var(--accent, #1a73e8)' }}>{t.ticket.id}</strong>
                    <span className="muted small">{t.customer?.name}</span>
                  </span>
                  <span className="tag" style={{ fontSize: '0.75rem' }}>Ticket</span>
                </button>
              ))}

              {searchResults.orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="google-search-result-item"
                  onClick={() => {
                    setSelectedId(o.id);
                    setView('orders');
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, #e8eaed)',
                    background: 'var(--surface-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📦</span>
                    <strong style={{ color: 'var(--accent, #1a73e8)' }}>{o.id}</strong>
                    <span className="muted small">{o.sku}</span>
                  </span>
                  <span className="tag" style={{ fontSize: '0.75rem' }}>Order</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="view-tabs" aria-label="Dashboard view">
        <button
          type="button"
          className={`view-tab ${view === 'orders' ? 'is-active' : ''}`}
          aria-pressed={view === 'orders'}
          onClick={() => setView('orders')}
        >
          Orders &amp; recovery
        </button>
        <button
          type="button"
          className={`view-tab ${view === 'tickets' ? 'is-active' : ''}`}
          aria-pressed={view === 'tickets'}
          onClick={() => {
            setView('tickets');
          }}
        >
          Support tickets
          {tickets.data && tickets.data.length > 0 && <span className="count">{tickets.data.length}</span>}
        </button>
      </nav>

      {view === 'orders' ? (
        <main className="layout">
          <aside className="layout__queue" aria-label="Order queue and failure injection">
            <ScenarioInjector onInjected={onInjected} />
            <OrderQueue
              orders={orders.data}
              loading={orders.loading}
              error={orders.error}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                addAction('Order', `Inspected order workspace for ${id}`);
              }}
              onRetry={() => void orders.refresh()}
            />
          </aside>
          <section id="workspace" className="layout__workspace" aria-label="Order workspace" tabIndex={-1}>
            {selectedId ? (
              <OrderWorkspace key={selectedId} orderId={selectedId} onChanged={() => void orders.refresh()} />
            ) : (
              <EmptyState title="No order selected">Select an order from the queue, or inject a failure scenario to create one.</EmptyState>
            )}
          </section>
        </main>
      ) : selectedTicketId ? (
        /* Dedicated Ticket Details Page (Opens on its own full page at the top) */
        <main className="layout layout--tickets-single" aria-label="Support ticket details page">
          <TicketDetailsPage
            ticketId={selectedTicketId}
            allTickets={tickets.data || []}
            currentUser={currentUser}
            onBack={() => {
              setSelectedTicketId(null);
              safeScrollToTop();
            }}
            onSelectTicket={handleSelectTicket}
            onOpenOrder={(orderId) => {
              setSelectedId(orderId);
              setView('orders');
            }}
          />
        </main>
      ) : (
        /* Support Tickets Queue Page (Full Page View) */
        <main className="layout layout--tickets-single" aria-label="Support tickets list page">
          <TicketQueue
            tickets={tickets.data}
            loading={tickets.loading}
            error={tickets.error}
            selectedId={selectedTicketId}
            onSelect={handleSelectTicket}
            onRetry={() => void tickets.refresh()}
          />
        </main>
      )}

      {/* Settings Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={currentUser}
        onUpdateUser={handleUpdateUser}
        actions={actions}
        onClearActions={handleClearActions}
        onSignOut={onSignOut}
        initialTab={settingsTab}
      />

      {/* Service Mesh Health Modal */}
      <ServiceHealthModal
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        ordersCount={orders.data?.length ?? 0}
        ticketsCount={tickets.data?.length ?? 0}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Page Note Footer strictly below the page */}
      <footer className="app-footer">
        Relay operations dashboard · all payment, inventory and shipping services are simulated · API: <code>{API_URL}</code>
      </footer>
    </>
  );
}

export default function App() {
  if (isSupportPath()) {
    return <SupportApp />;
  }

  const [adminToken, setAdminToken] = useState<string | null>(() => readStoredAdminToken());
  const [currentUser, setCurrentUser] = useState<AdminUser>(() => readStoredAdminUser());

  const handleUpdateUser = (updated: Partial<AdminUser>) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...updated };
      try {
        sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!adminToken) {
    return (
      <AdminSignInView
        onSignedIn={(token, admin) => {
          persistAdminSession(token, admin);
          setAdminToken(token);
          if (admin) setCurrentUser(admin);
        }}
      />
    );
  }

  return (
    <OperationsDashboard
      currentUser={currentUser}
      onUpdateUser={handleUpdateUser}
      onSignOut={() => {
        persistAdminSession(null);
        setAdminToken(null);
      }}
    />
  );
}

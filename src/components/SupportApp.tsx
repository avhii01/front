import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createConversation as createCustomerConversation,
  customerMe,
  customerSignIn,
  customerSignOut,
  registerCustomer,
  errorMessage,
  getConfig,
  getConversation,
  sendChatMessage,
} from '../api';
import { formatTime } from '../format';
import { usePolling } from '../hooks';
import type {
  AppConfig,
  Customer as CustomerType,
} from '../types';
import { ErrorState, InlineError, Skeleton } from './States';

const TOKEN_KEY = 'relay.customer.token';
const CUSTOMER_KEY = 'relay.customer';
const CONVERSATION_POLL_MS = 2500;

interface Auth {
  token: string;
  customer: CustomerType;
}

function readStoredAuth(): Auth | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const raw = sessionStorage.getItem(CUSTOMER_KEY);
    if (!token || !raw) return null;
    const customer = JSON.parse(raw) as CustomerType;
    if (!customer?.id) return null;
    return { token, customer };
  } catch {
    return null;
  }
}

function persistAuth(auth: Auth | null) {
  try {
    if (!auth) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(CUSTOMER_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, auth.token);
      sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify(auth.customer));
    }
  } catch {
    // Storage can be unavailable in private mode; the in-memory session still works.
  }
}

interface ChatOption {
  label: string;
  value: string;
}

function messageOptions(meta: Record<string, unknown>): ChatOption[] {
  const raw = meta.options;
  if (!Array.isArray(raw)) return [];
  const options: ChatOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const label = (item as { label?: unknown }).label;
    if (typeof label !== 'string' || !label.trim()) continue;
    const value = (item as { value?: unknown }).value;
    options.push({ label, value: typeof value === 'string' ? value : label });
  }
  return options;
}

/** Customer support: simulated sign-in + chat with Salesforce Einstein Bot aesthetic. */
export default function SupportApp() {
  const config = usePolling(getConfig, 'support-config', null);
  const [auth, setAuth] = useState<Auth | null>(() => readStoredAuth());
  const [checking, setChecking] = useState<boolean>(() => readStoredAuth() !== null);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    customerMe(auth.token)
      .then((me) => {
        if (cancelled) return;
        const next = { token: auth.token, customer: me.customer };
        setAuth(next);
        persistAuth(next);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          persistAuth(null);
          setAuth(null);
        } else {
          setSignInError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-check when the token changes; the customer object is replaced on sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  const signIn = async (email: string, password: string) => {
    setSignInError(null);
    try {
      const res = await customerSignIn(email, password);
      const next = { token: res.token, customer: res.customer };
      persistAuth(next);
      setAuth(next);
      setChecking(false);
    } catch (e) {
      setSignInError(errorMessage(e));
    }
  };

  const register = async (name: string, email: string, userId: string, password: string) => {
    setSignInError(null);
    try {
      const res = await registerCustomer(name, email, userId, password);
      const next = { token: res.token, customer: res.customer };
      persistAuth(next);
      setAuth(next);
      setChecking(false);
    } catch (e) {
      setSignInError(errorMessage(e));
    }
  };

  if (checking) {
    return (
      <main className="support-shell">
        <Skeleton lines={6} label="Restoring customer session" />
      </main>
    );
  }

  if (!auth) {
    return (
      <SupportSignIn
        error={signInError}
        configBadges={<SupportBadges config={config.data} />}
        onSignIn={signIn}
        onRegister={register}
      />
    );
  }

  return (
    <SupportWorkspace
      auth={auth}
      configBadges={<SupportBadges config={config.data} />}
      onSignOut={() => {
        void customerSignOut(auth.token).catch(() => {});
        persistAuth(null);
        setAuth(null);
      }}
      onAuthExpired={() => {
        persistAuth(null);
        setAuth(null);
      }}
    />
  );
}

function SupportBadges({ config }: { config: AppConfig | null }) {
  return (
    <>
      <span className="badge badge--simulated">SIMULATED services</span>
      <span className="badge" title="Local demo only. The backend validates a server-side session; this is not production authentication.">
        SIMULATED customer sign-in
      </span>
      {config?.support && (
        <span className="badge" title="Retrieval and answer engine are shown on each answer.">
          {config.support.embedding_key_configured
            ? `Embeddings: ${config.support.rag_embedding_model ?? 'configured'} · ${config.support.vector_backend}`
            : 'Lexical retrieval fallback (no embedding key)'}
        </span>
      )}
    </>
  );
}

function SupportSignIn({
  error,
  configBadges,
  onSignIn,
  onRegister,
}: {
  error: string | null;
  configBadges: ReactNode;
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, userId: string, password: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'signin') {
        await onSignIn(email, password);
      } else {
        await onRegister(regName, regEmail, regUserId, regPassword);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SupportHeader
        subtitle="Customer support · grounded policy answers · order recovery"
        badges={configBadges}
      />
      <main className="support-shell">
        <section className="panel support-signin slds-auth-card" aria-labelledby="signin-title">
          <div className="slds-auth-header-icon" aria-hidden="true">
            <span style={{ fontSize: '2rem' }}>☁️</span>
          </div>

          <div className="slds-tabs--scoped" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              className={`view-tab slds-tab ${tab === 'signin' ? 'is-active' : ''}`}
              onClick={() => setTab('signin')}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Customer Login
            </button>
            <button
              type="button"
              className={`view-tab slds-tab ${tab === 'register' ? 'is-active' : ''}`}
              onClick={() => setTab('register')}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Create Account
            </button>
          </div>

          <h2 id="signin-title" className="panel__title">
            {tab === 'signin' ? 'Sign in to the demo store' : 'Create a new customer account'}
          </h2>
          <p className="muted">
            {tab === 'signin'
              ? 'Sign in to chat with support and track your verified orders.'
              : 'Register your details. New accounts are saved into users.xlsx and users.csv.'}
          </p>

          {tab === 'signin' ? (
            <form className="form slds-form" onSubmit={(e) => void submit(e)}>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="you@example.com"
                  className="slds-input"
                />
              </label>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Your password"
                  className="slds-input"
                />
              </label>
              <div className="controls">
                <button type="submit" className="btn btn--primary slds-btn slds-btn--brand" disabled={busy || !email.trim() || !password}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <button type="button" className="btn btn--ghost slds-btn" onClick={() => setTab('register')}>
                  New customer? Create account
                </button>
              </div>
            </form>
          ) : (
            <form className="form slds-form" onSubmit={(e) => void submit(e)}>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">Full Name</span>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="e.g. John Doe"
                  className="slds-input"
                />
              </label>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">Email ID</span>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="e.g. john@example.com"
                  className="slds-input"
                />
              </label>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">User ID (optional)</span>
                <input
                  type="text"
                  value={regUserId}
                  onChange={(e) => setRegUserId(e.target.value)}
                  placeholder="e.g. USR-1001 (leave empty for auto)"
                  className="slds-input"
                />
              </label>
              <label className="field slds-form-element">
                <span className="field__label slds-form-element__label">Password</span>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Choose a password"
                  className="slds-input"
                />
              </label>
              <div className="controls">
                <button type="submit" className="btn btn--primary slds-btn slds-btn--brand" disabled={busy || !regName.trim() || !regEmail.trim() || !regPassword}>
                  {busy ? 'Creating account…' : 'Create account & Sign in'}
                </button>
                <button type="button" className="btn btn--ghost slds-btn" onClick={() => setTab('signin')}>
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}

          {error && <InlineError message={error} />}

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <span className="muted small">Are you an operator or administrator? </span>
            <a
              href="/"
              style={{ fontWeight: 600, color: 'var(--accent, #1a73e8)', textDecoration: 'underline', fontSize: '0.88rem' }}
            >
              Switch to Operator Admin Sign In ↗
            </a>
          </div>
        </section>
      </main>
      <SupportFooter />
    </>
  );
}

function SupportWorkspace({
  auth,
  configBadges,
  onAuthExpired,
  onSignOut,
}: {
  auth: Auth;
  configBadges: ReactNode;
  onAuthExpired: () => void;
  onSignOut: () => void;
}) {
  const { token, customer } = auth;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const startNewChat = async () => {
    setBusy(true);
    setSendError(null);
    try {
      const created = await createCustomerConversation(token);
      setSelectedId(created.id);
      conversation.setData(created);
      setComposer('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthExpired();
      else setSendError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const conversation = usePolling(
    () => getConversation(token, selectedId as string),
    selectedId ? `conversation:${selectedId}` : null,
    CONVERSATION_POLL_MS,
  );
  const messagesEnd = useRef<HTMLDivElement | null>(null);
  const messageCount = conversation.data?.messages.length ?? 0;
  useEffect(() => {
    messagesEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [messageCount]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void createCustomerConversation(token)
      .then((created) => {
        setSelectedId(created.id);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) onAuthExpired();
        else setSendError(errorMessage(e));
      });
  }, [token, onAuthExpired]);

  useEffect(() => {
    if (sendError && conversation.error) return;
    if (conversation.error) setSendError(conversation.error);
  }, [conversation.error, sendError]);

  const send = async (text: string) => {
    if (!selectedId || !text.trim() || busy) return;
    setBusy(true);
    setSendError(null);
    try {
      const res = await sendChatMessage(token, selectedId, text.trim());
      if (res.error) {
        setSendError(res.error);
      } else {
        conversation.setData(res.conversation);
        setComposer('');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthExpired();
      else setSendError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const data = conversation.data;

  return (
    <>
      <SupportHeader
        subtitle={`Customer support · signed in as ${customer.name} (simulated)`}
        badges={configBadges}
      />
      <main className="support-layout">
        <section className="support-chat" aria-label="Support chat">
          <div className="chat-panel slds-einstein-chat">
            {/* Salesforce Einstein Bot Chat Header */}
            <div className="chat-panel__head slds-chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="slds-bot-avatar" aria-hidden="true">
                  🤖
                  <span className="slds-online-beacon" title="Online & active"></span>
                </div>
                <div>
                  <h2 className="panel__title" style={{ margin: 0, fontSize: '1.15rem' }}>Support chat</h2>
                  <p className="muted small" style={{ margin: 0 }}>
                    Signed in as <strong>{customer.name}</strong> ({customer.email})
                  </p>
                </div>
              </div>
              <div className="chat-panel__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm slds-btn"
                  onClick={() => void startNewChat()}
                  disabled={busy}
                >
                  New chat
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm slds-btn"
                  onClick={onSignOut}
                  disabled={busy}
                >
                  Sign out
                </button>
              </div>
            </div>

            {!selectedId ? (
              <Skeleton lines={6} label="Opening support chat" />
            ) : conversation.loading && !data ? (
              <Skeleton lines={8} label="Loading chat history" />
            ) : conversation.error && !data ? (
              <ErrorState
                title="Could not load the conversation"
                message={conversation.error}
                onRetry={() => void conversation.refresh()}
              />
            ) : (
              <>
                <div className="chat-log slds-chat-log" role="log" aria-live="polite">
                  {(!data?.messages || data.messages.length === 0) && (
                    <div className="chat-empty-state slds-chat-empty">
                      <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🤖</div>
                      <p className="strong" style={{ fontSize: '1.1rem' }}>Welcome to Salesforce Einstein Support, {customer.name}!</p>
                      <p className="muted">Say <strong>&quot;Hi&quot;</strong> to begin your conversation or ask about an order.</p>
                    </div>
                  )}
                  {data?.messages.map((message, index) => {
                    const options = message.role === 'assistant' ? messageOptions(message.meta) : [];
                    const showOptions = options.length > 0 && index === data.messages.length - 1 && !busy;
                    const isAssistant = message.role === 'assistant';

                    return (
                      <article key={message.id} className={`chat-message chat-message--${message.role} slds-chat-message`}>
                        {isAssistant && (
                          <div className="slds-message-avatar" aria-hidden="true" title="Einstein AI">
                            🤖
                          </div>
                        )}
                        <div className="chat-message__bubble slds-chat-bubble">
                          <p className="chat-message__text" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                          {showOptions && (
                            <div className="chat-options slds-quick-replies" role="group" aria-label="Suggested replies">
                              {options.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  className="chat-option slds-quick-reply-pill"
                                  disabled={busy}
                                  onClick={() => void send(option.label)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="chat-message__meta">
                            <span>{formatTime(message.created_at)}</span>
                            {isAssistant && <span style={{ marginLeft: '4px' }}>· Einstein AI</span>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  <div ref={messagesEnd} />
                </div>

                {sendError && <InlineError message={sendError} />}

                <form
                  className="chat-composer slds-chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(composer);
                  }}
                >
                  <label className="visually-hidden" htmlFor="support-message">
                    Message to support
                  </label>
                  <div className="slds-composer-input-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      id="support-message"
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send(composer);
                        }
                      }}
                      rows={2}
                      maxLength={2000}
                      placeholder="Type a message... (e.g. 'Hi')"
                      disabled={busy}
                      className="slds-textarea slds-chat-textarea"
                    />
                    <div className="controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="muted small">Press Enter to send · Shift+Enter adds a line</span>
                      <button type="submit" className="btn btn--primary slds-btn slds-btn--brand" disabled={busy || !composer.trim()}>
                        {busy ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <SupportFooter />
    </>
  );
}

function SupportHeader({ subtitle, badges }: { subtitle: string; badges: ReactNode }) {
  return (
    <header className="app-header support-header slds-support-header">
      <div className="app-header__title">
        <div className="slds-app-badge" aria-hidden="true">☁️</div>
        <h1>Relay</h1>
        <span className="app-header__subtitle">{subtitle}</span>
      </div>
      <div className="app-header__badges">{badges}</div>
      <p className="app-header__note">
        Policy guidance is retrieved from a small, versioned demo knowledge base. Order, payment, inventory and
        shipping state is always read from the simulated service APIs. The chatbot cannot approve refunds.
      </p>
    </header>
  );
}

function SupportFooter() {
  return (
    <footer className="app-footer">
      Relay customer support · simulated storefront and services · no real money, stock or shipments move
    </footer>
  );
}

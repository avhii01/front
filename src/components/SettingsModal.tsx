import { useEffect, useState } from 'react';
import { errorMessage, updateUserCredentials } from '../api';
import { formatDateTime } from '../format';
import {
  type SupportMember,
  type SupportRole,
  type TeamLogEntry,
  addSupportMember,
  clearTeamLogs,
  getSupportTeam,
  getTeamLogs,
  removeSupportMember,
  syncTeamFromBackend,
  updateSupportMember,
} from '../team';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  loginTime?: string;
}

export interface OperatorAction {
  id: string;
  timestamp: string;
  category: 'Auth' | 'Ticket' | 'Order' | 'Settings' | 'Resolution';
  description: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser;
  onUpdateUser: (updated: Partial<AdminUser>) => void;
  actions?: OperatorAction[];
  onClearActions?: () => void;
  onSignOut?: () => void;
  initialTab?: 'profile' | 'personal' | 'team' | 'policies' | 'actions';
}

const POLICIES = [
  {
    id: 'P-ALLOW',
    title: 'Idempotent Automated Recovery',
    category: 'System Automation',
    summary: 'Permits automatic retries for idempotent mutating service tools (e.g. create_shipment, confirm_payment) upon transient network or timeout failures.',
    status: 'Enforced',
    statusTone: 'ok',
  },
  {
    id: 'P-REFUND-MAX',
    title: 'Refund Authorization Threshold ($50.00)',
    category: 'Financial Risk',
    summary: 'Refunds exceeding $50.00 USD, or cases with conflicting payment captures, strictly require human operator review and manual approval.',
    status: 'Enforced',
    statusTone: 'warn',
  },
  {
    id: 'P-RESOLVE-PERM',
    title: 'Permanent Resolution Lock',
    category: 'Workflow Integrity',
    summary: 'Once marked Resolved by an operator or verified automated pipeline, the case record is permanently locked against unauthorized reopening.',
    status: 'Enforced',
    statusTone: 'ok',
  },
  {
    id: 'P-HOLD-SLA',
    title: 'On-Hold Escalation SLA (3 Days)',
    category: 'Service Level Agreement',
    summary: 'Cases held in On Hold status for more than 3 consecutive days automatically trigger an escalated supervisor alert with high priority.',
    status: 'Active',
    statusTone: 'warn',
  },
  {
    id: 'P-PRIVACY-STRICT',
    title: 'PII & Payment Data Masking',
    category: 'Compliance & Security',
    summary: 'Customer payment details, raw card tokens, and sensitive authentication fields are masked before persisting to service evidence or audit exports.',
    status: 'Enforced',
    statusTone: 'ok',
  },
  {
    id: 'P-AUDIT-TRAIL',
    title: 'Immutable Audit Trail',
    category: 'Governance & Auditing',
    summary: 'Every mutation, assignee transfer, status change, and approval decision is cryptographically sequenced into the session audit log.',
    status: 'Active',
    statusTone: 'ok',
  },
];

const AVAILABLE_ROLES: { role: SupportRole; label: string; desc: string }[] = [
  {
    role: 'Support Specialist',
    label: 'Support Specialist',
    desc: 'Frontline ticket investigation & resolution',
  },
  {
    role: 'Senior Specialist',
    label: 'Senior Specialist',
    desc: 'Escalations, complex disputes & overrides',
  },
  {
    role: 'Billing Specialist',
    label: 'Billing Specialist',
    desc: 'Payment reconciliations & refund processing',
  },
  {
    role: 'Logistics Coordinator',
    label: 'Logistics Coordinator',
    desc: 'Freight carriers, shipments & tracking',
  },
  {
    role: 'Operations Admin',
    label: 'Operations Admin',
    desc: 'Full administrative rights & system control',
  },
];

const DEPARTMENTS = [
  'Customer Operations & Reliability',
  'Payments & Billing',
  'Shipping & Logistics',
  'Platform Reliability',
];

export function SettingsModal({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  actions = [],
  onClearActions,
  onSignOut,
  initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'personal' | 'team' | 'policies' | 'actions'>(initialTab || 'profile');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Support Team State
  const isAdmin = Boolean((user.role || '').toLowerCase().includes('admin') || (user.id || '').toUpperCase().startsWith('ADM'));
  const [team, setTeam] = useState<SupportMember[]>(() => getSupportTeam());
  const [teamLogs, setTeamLogs] = useState<TeamLogEntry[]>(() => getTeamLogs());
  const [teamSubView, setTeamSubView] = useState<'members' | 'logs'>('members');
  const [logFilterQuery, setLogFilterQuery] = useState('');

  // Add Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('relay123');
  const [newMemberRole, setNewMemberRole] = useState<SupportRole>('Support Specialist');
  const [newMemberDept, setNewMemberDept] = useState<string>(DEPARTMENTS[0] || 'Customer Operations & Reliability');
  const [memberNotice, setMemberNotice] = useState<string | null>(null);

  // Profile / Name / ID change state
  const [nameInput, setNameInput] = useState(user.name);
  const [nameNotice, setNameNotice] = useState<string | null>(null);
  const [idInput, setIdInput] = useState(user.id);
  const [idNotice, setIdNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [idBusy, setIdBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Preferences
  const [themePref, setThemePref] = useState<'light' | 'system' | 'dark'>('light');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Sync team updates when custom event fires
  useEffect(() => {
    const handleSync = () => {
      setTeam(getSupportTeam());
      setTeamLogs(getTeamLogs());
    };
    window.addEventListener('relay-team-updated', handleSync);
    return () => window.removeEventListener('relay-team-updated', handleSync);
  }, []);

  // Sync fresh team data from backend with role-based visibility when modal opens
  useEffect(() => {
    if (isOpen) {
      void syncTeamFromBackend(user.role, user.id);
    }
  }, [isOpen, user.role, user.id]);

  if (!isOpen) return null;

  const handleCopyId = () => {
    try {
      void navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onUpdateUser({ name: nameInput.trim() });
    setNameNotice('Display name updated successfully.');
    setTimeout(() => setNameNotice(null), 3000);
  };

  const handleSaveId = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdNotice(null);
    const trimmedId = idInput.trim();
    if (!trimmedId) return;
    if (trimmedId === user.id) {
      setIdNotice({ type: 'ok', text: `ID is already set to ${trimmedId}` });
      return;
    }
    setIdBusy(true);
    try {
      const res = await updateUserCredentials({
        member_id: user.id,
        new_id: trimmedId,
      });
      onUpdateUser({ id: res.member.id });
      setIdNotice({
        type: 'ok',
        text: `✓ User ID successfully updated to "${res.member.id}" in Neon database!`,
      });
      void syncTeamFromBackend(user.role, res.member.id);
    } catch (err) {
      setIdNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setIdBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordNotice({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPasswordBusy(true);
    try {
      await updateUserCredentials({
        member_id: user.id,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordNotice({
        type: 'ok',
        text: '✓ Password successfully changed and saved to Neon database!',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void syncTeamFromBackend(user.role, user.id);
    } catch (err) {
      setPasswordNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMemberNotice('❌ Permission Denied: Only administrators have policy permissions to add team members.');
      return;
    }
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const added = addSupportMember(
      {
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
        department: newMemberDept,
        status: 'active',
        password: newMemberPassword.trim() || 'relay123',
      },
      user.name,
      user.role,
      user.id,
    );

    setTeam(getSupportTeam());
    setTeamLogs(getTeamLogs());
    setMemberNotice(`✓ Added ${added.name} (${added.role}) with ID ${added.id} and password "${added.password}". Credentials saved to database.`);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPassword('relay123');
    setTimeout(() => setMemberNotice(null), 6000);
  };

  const handleToggleMemberStatus = (id: string, currentStatus: SupportMember['status']) => {
    const nextStatus = currentStatus === 'active' ? 'away' : currentStatus === 'away' ? 'offline' : 'active';
    updateSupportMember(id, { status: nextStatus }, user.name);
    setTeam(getSupportTeam());
    setTeamLogs(getTeamLogs());
  };

  const handleRemoveMember = (id: string, name: string) => {
    if (!isAdmin) {
      alert('Permission Denied: Only administrators can remove team members.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove ${name} from the support team roster?`)) {
      removeSupportMember(id, user.name, user.role, user.id);
      setTeam(getSupportTeam());
      setTeamLogs(getTeamLogs());
    }
  };

  const handleExportActions = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(actions, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `operator-actions-${user.id}-${Date.now()}.json`;
    a.click();
  };

  const handleExportTeamLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(teamLogs, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `team-logs-${Date.now()}.json`;
    a.click();
  };

  const filteredTeamLogs = teamLogs.filter((l) => {
    if (!logFilterQuery.trim()) return true;
    const q = logFilterQuery.toLowerCase();
    return (
      l.description.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.target && l.target.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="google-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="google-modal-card" style={{ maxWidth: '880px' }}>
        {/* Modal Top Header */}
        <div className="google-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="google-service-icon"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#e8f0fe',
                color: '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              👤
            </div>
            <div>
              <h2 id="settings-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Operations Settings &amp; Team Management
              </h2>
              <span className="muted small">
                Manage operator identity, add support persons to resolve tickets, view Team Logs, and configure governance policies.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="google-modal-close"
            onClick={onClose}
            aria-label="Close settings dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="google-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`google-modal-tab ${activeTab === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            🆔 My ID &amp; Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personal'}
            className={`google-modal-tab ${activeTab === 'personal' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            ⚙️ Personal Settings &amp; Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'team'}
            className={`google-modal-tab ${activeTab === 'team' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            👥 Support Team &amp; Logs ({team.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policies'}
            className={`google-modal-tab ${activeTab === 'policies' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('policies')}
          >
            📜 Simulation Policies &amp; Rules
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'actions'}
            className={`google-modal-tab ${activeTab === 'actions' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            ⚡ Audit Log ({actions.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="google-modal-body">
          {/* TAB 1: My ID & Profile */}
          {activeTab === 'profile' && (
            <div className="settings-tab-pane">
              <div className="settings-profile-hero">
                <div className="settings-hero-avatar">
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'OP'}
                </div>
                <div className="settings-hero-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{user.name}</h3>
                    <span className="badge badge--allowed" style={{ fontSize: '0.78rem' }}>
                      ● Active Operator
                    </span>
                  </div>
                  <span className="muted" style={{ fontSize: '0.9rem' }}>{user.email}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span className="tag" style={{ background: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                      {user.role}
                    </span>
                    <span className="tag" style={{ background: '#f1f3f4', color: '#3c4043' }}>
                      {user.department ?? 'Customer Operations & Reliability'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="settings-id-grid">
                <div className="settings-id-card">
                  <span className="settings-card-label">OPERATOR ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <code style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent, #1a73e8)' }}>
                      {user.id}
                    </code>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={handleCopyId}
                      style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                    >
                      {copiedId ? '✓ Copied' : 'Copy ID'}
                    </button>
                  </div>
                  <span className="muted small" style={{ marginTop: '4px', display: 'block' }}>
                    Unique identity token bound to active session.
                  </span>
                </div>

                <div className="settings-id-card">
                  <span className="settings-card-label">ACCESS LEVEL</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                    Tier 3 · Operations Lead &amp; Resolver
                  </span>
                  <span className="muted small" style={{ marginTop: '4px', display: 'block' }}>
                    Permissions: Resolve tickets, add team persons, approve refunds.
                  </span>
                </div>

                <div className="settings-id-card">
                  <span className="settings-card-label">PRIMARY WORK EMAIL</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                    {user.email}
                  </span>
                  <span className="muted small" style={{ marginTop: '4px', display: 'block' }}>
                    Receives supervisor notifications &amp; escalation alerts.
                  </span>
                </div>

                <div className="settings-id-card">
                  <span className="settings-card-label">SESSION STARTED</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                    {formatDateTime(user.loginTime ?? new Date().toISOString())}
                  </span>
                  <span className="muted small" style={{ marginTop: '4px', display: 'block' }}>
                    Authenticated from IP 127.0.0.1 (Local Developer Console).
                  </span>
                </div>

                <div className="settings-id-card" style={{ gridColumn: 'span 2' }}>
                  <span className="settings-card-label">DECISION ENGINE &amp; GOVERNANCE</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', display: 'block', color: 'var(--ok, #1e8e3e)' }}>
                    ✓ Deterministic Policy Engine Active (No Language Model Involved)
                  </span>
                  <span className="muted small" style={{ marginTop: '4px', display: 'block' }}>
                    All recovery steps adhere to deterministic state machine rules and verified policies.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Personal Settings (Password & Name) */}
          {activeTab === 'personal' && (
            <div className="settings-tab-pane">
              <section className="settings-section">
                <h4 className="settings-section-title">Change Display Name / Username</h4>
                <p className="muted small">
                  Update how your name appears on assigned tickets, audit trails, and supervisor resolution notes.
                </p>
                <form onSubmit={handleSaveName} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="google-input"
                    style={{ flex: 1, minWidth: '220px', maxWidth: '380px' }}
                    required
                  />
                  <button type="submit" className="btn btn--primary btn--sm">
                    Save Username
                  </button>
                </form>
                {nameNotice && (
                  <div className="notice google-notice" style={{ marginTop: '10px' }}>
                    ✓ {nameNotice}
                  </div>
                )}
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light, #e8eaed)', margin: '20px 0' }} />

              <section className="settings-section">
                <h4 className="settings-section-title">Change Specialist / Admin ID</h4>
                <p className="muted small">
                  Your staff login identifier stored directly in the Neon <code>team_members</code> table (e.g. <code>ADM-9041</code> or <code>SPT-1002</code>). You can customize this ID and save it to the database.
                </p>
                {idNotice && (
                  <div
                    className={idNotice.type === 'ok' ? 'notice google-notice' : 'inline-error'}
                    style={{ margin: '12px 0' }}
                  >
                    {idNotice.text}
                  </div>
                )}
                <form onSubmit={handleSaveId} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={idInput}
                    onChange={(e) => setIdInput(e.target.value)}
                    placeholder="Enter staff ID (e.g. SPT-1002)"
                    className="google-input"
                    style={{ flex: 1, minWidth: '220px', maxWidth: '380px' }}
                    required
                  />
                  <button type="submit" className="btn btn--primary btn--sm" disabled={idBusy || !idInput.trim()}>
                    {idBusy ? 'Saving ID…' : 'Save ID'}
                  </button>
                </form>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light, #e8eaed)', margin: '20px 0' }} />

              <section className="settings-section">
                <h4 className="settings-section-title">Change Account Password</h4>
                <p className="muted small">
                  Update your operator login password. Passwords will be securely hashed and saved directly into the Neon database.
                </p>

                {passwordNotice && (
                  <div
                    className={passwordNotice.type === 'ok' ? 'notice google-notice' : 'inline-error'}
                    style={{ margin: '12px 0' }}
                  >
                    {passwordNotice.text}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} style={{ display: 'grid', gap: '12px', maxWidth: '420px', marginTop: '10px' }}>
                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="field__label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Current Password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="google-input"
                      required
                    />
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="field__label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>New Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 6 chars)"
                      className="google-input"
                      required
                    />
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="field__label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Confirm New Password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="google-input"
                      required
                    />
                  </label>

                  <div style={{ marginTop: '6px' }}>
                    <button type="submit" className="btn btn--primary btn--sm" disabled={passwordBusy || !currentPassword || !newPassword}>
                      {passwordBusy ? 'Saving Password…' : 'Update Password in Database'}
                    </button>
                  </div>
                </form>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light, #e8eaed)', margin: '20px 0' }} />

              <section className="settings-section">
                <h4 className="settings-section-title">Console Preferences</h4>
                <div style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Theme Mode</strong>
                      <div className="muted small">Select your visual interface appearance</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={`btn btn--sm ${themePref === 'light' ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setThemePref('light')}
                      >
                        ☀️ Light
                      </button>
                      <button
                        type="button"
                        className={`btn btn--sm ${themePref === 'dark' ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setThemePref('dark')}
                      >
                        🌙 Dark
                      </button>
                      <button
                        type="button"
                        className={`btn btn--sm ${themePref === 'system' ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setThemePref('system')}
                      >
                        💻 System
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Audio Alerts</strong>
                      <div className="muted small">Play chime when a new customer ticket arrives</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundAlerts}
                      onChange={(e) => setSoundAlerts(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: Support Team & Logs (NEW) */}
          {activeTab === 'team' && (
            <div className="settings-tab-pane">
              {/* Header with Sub-tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    Support Team Members &amp; Activity Logs
                  </h4>
                  <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                    Add support specialists and operators to resolve tickets, assign customer cases, and audit team activities.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className={`btn btn--sm ${teamSubView === 'members' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setTeamSubView('members')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    👥 Team Roster ({team.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${teamSubView === 'logs' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setTeamSubView('logs')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    📜 Team Logs ({teamLogs.length})
                  </button>
                </div>
              </div>

              {/* Sub-view 1: Team Members & Add Form */}
              {teamSubView === 'members' && (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {!isAdmin ? (
                    <div
                      style={{
                        background: 'var(--surface-2, #f8fafc)',
                        padding: '16px 20px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                      <div>
                        <strong style={{ fontSize: '0.98rem' }}>Administrator Policy Notice</strong>
                        <p className="muted small" style={{ margin: '3px 0 0 0' }}>
                          Only administrators have policy permission to add, modify, or remove support team members. Support specialists and operators have read-only access to view the team roster.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Add New Support Person Card */
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        padding: '16px 20px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>➕</span>
                        <strong style={{ fontSize: '1rem' }}>Add Support Person or Specialist to Resolve Tickets</strong>
                      </div>
                      <p className="muted small" style={{ margin: '0 0 12px 0' }}>
                        Add non-admin or admin team members (Support Specialists, Billing Specialists, Logistics Coordinators) who can be assigned tickets, investigate customer issues, and execute resolutions.
                      </p>

                      {memberNotice && (
                        <div className="notice google-notice" style={{ marginBottom: '14px' }}>
                          {memberNotice}
                        </div>
                      )}

                      <form onSubmit={handleAddMember} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field__label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Full Name *</span>
                          <input
                            type="text"
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            placeholder="e.g. Priya Sharma"
                            className="google-input"
                            required
                          />
                        </label>

                        <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field__label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Work Email *</span>
                          <input
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            placeholder="priya.sharma@relay.internal"
                            className="google-input"
                            required
                          />
                        </label>

                        <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field__label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Support Role *</span>
                          <select
                            value={newMemberRole}
                            onChange={(e) => setNewMemberRole(e.target.value as SupportRole)}
                            className="google-select"
                          >
                            {AVAILABLE_ROLES.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field__label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Login Password *</span>
                          <input
                            type="text"
                            value={newMemberPassword}
                            onChange={(e) => setNewMemberPassword(e.target.value)}
                            placeholder="e.g. relay123"
                            className="google-input"
                            required
                          />
                        </label>

                        <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field__label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Department *</span>
                          <select
                            value={newMemberDept}
                            onChange={(e) => setNewMemberDept(e.target.value)}
                            className="google-select"
                          >
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button type="submit" className="btn btn--primary btn--sm">
                            + Add Support Member
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Active Support Team Roster */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Active Support Team Roster ({team.length} Members)</span>
                      <span className="muted small">Team members are directly available in ticket assignee selectors</span>
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                      {team.map((member) => {
                        const isSelf = member.id === user.id || member.email === user.email;
                        const initials = member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        const roleBadgeColor =
                          member.role === 'Operations Admin'
                            ? { bg: '#f3e8fd', color: '#9334e6' }
                            : member.role === 'Senior Specialist'
                            ? { bg: '#e8f0fe', color: '#1a73e8' }
                            : member.role === 'Billing Specialist'
                            ? { bg: '#fef7e0', color: '#b06000' }
                            : member.role === 'Logistics Coordinator'
                            ? { bg: '#e6f4ea', color: '#137333' }
                            : { bg: '#e0f2f1', color: '#00796b' };

                        return (
                          <div
                            key={member.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              gap: '12px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: roleBadgeColor.bg,
                                  color: roleBadgeColor.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '0.98rem' }}>{member.name}</strong>
                                  <code style={{ fontSize: '0.78rem', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>
                                    ID: {member.id}
                                  </code>
                                  {isAdmin && member.password && (
                                    <code style={{ fontSize: '0.78rem', background: '#fef7e0', color: '#b06000', padding: '2px 6px', borderRadius: '4px', border: '1px solid #f9ab00' }}>
                                      🔑 Password: {member.password}
                                    </code>
                                  )}
                                  {isSelf && (
                                    <span className="tag" style={{ background: '#e8f0fe', color: '#1a73e8', fontSize: '0.72rem' }}>
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="muted small" style={{ marginTop: '2px' }}>
                                  {member.email} · {member.department}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <span
                                className="tag"
                                style={{
                                  background: roleBadgeColor.bg,
                                  color: roleBadgeColor.color,
                                  fontWeight: 600,
                                  fontSize: '0.78rem',
                                }}
                              >
                                {member.role}
                              </span>

                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => handleToggleMemberStatus(member.id, member.status)}
                                title="Click to toggle member shift status"
                                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                              >
                                {member.status === 'active' && '🟢 Active'}
                                {member.status === 'away' && '🟡 Away'}
                                {member.status === 'offline' && '⚪ Offline'}
                              </button>

                              {isAdmin && !isSelf && (
                                <button
                                  type="button"
                                  className="btn btn--sm btn--ghost"
                                  onClick={() => handleRemoveMember(member.id, member.name)}
                                  title="Remove member from team (Admin policy)"
                                  style={{ color: 'var(--bad, #d93025)', fontSize: '0.8rem', padding: '4px 8px' }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view 2: Team Logs */}
              {teamSubView === 'logs' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <input
                        type="search"
                        value={logFilterQuery}
                        onChange={(e) => setLogFilterQuery(e.target.value)}
                        placeholder="Filter team logs by specialist, ticket ID, or action..."
                        className="google-input"
                        style={{ width: '100%', maxWidth: '380px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={handleExportTeamLogs}
                        disabled={teamLogs.length === 0}
                      >
                        Export Team Logs
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => {
                          if (window.confirm('Clear all team activity records?')) {
                            clearTeamLogs();
                            setTeamLogs([]);
                          }
                        }}
                        disabled={teamLogs.length === 0}
                      >
                        Clear Team Logs
                      </button>
                    </div>
                  </div>

                  {filteredTeamLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '8px' }}>📜</span>
                      <strong>No matching team activity records found.</strong>
                      <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                        Actions taken by support specialists, ticket assignments, and roster changes will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="settings-actions-timeline">
                      {filteredTeamLogs.map((log) => (
                        <div key={log.id} className="settings-action-item">
                          <div className="settings-action-badge">
                            {log.action === 'member_added' && '👤'}
                            {log.action === 'member_updated' && '✏️'}
                            {log.action === 'member_removed' && '🗑️'}
                            {log.action === 'ticket_assigned' && '🎫'}
                            {log.action === 'ticket_resolved' && '✅'}
                            {log.action === 'status_changed' && '🔄'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{log.description}</span>
                              <span className="muted small" style={{ fontSize: '0.78rem' }}>
                                {formatDateTime(log.timestamp)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                              <span className="tag" style={{ fontSize: '0.72rem' }}>
                                Actor: {log.actor}
                              </span>
                              {log.target && (
                                <span className="tag" style={{ fontSize: '0.72rem', background: '#e8f0fe', color: '#1a73e8' }}>
                                  Target: {log.target}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Simulation Policies & Rules */}
          {activeTab === 'policies' && (
            <div className="settings-tab-pane">
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Active Governance Policies &amp; Rule Engine
                </h4>
                <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                  These deterministic policies dictate order recovery workflows and specialist authorization thresholds without language model hallucination.
                </p>
              </div>

              <div className="settings-policies-list">
                {POLICIES.map((p) => (
                  <div key={p.id} className="settings-policy-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code style={{ background: '#e8f0fe', color: '#1a73e8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {p.id}
                        </code>
                        <strong>{p.title}</strong>
                      </div>
                      <span className={`badge badge--${p.statusTone}`} style={{ fontSize: '0.75rem' }}>
                        {p.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted, #5f6368)', lineHeight: 1.5 }}>
                      {p.summary}
                    </p>
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Category: <strong>{p.category}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: My Actions & Audit Log */}
          {activeTab === 'actions' && (
            <div className="settings-tab-pane">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    My Actions &amp; Audit Trail
                  </h4>
                  <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                    Chronological ledger of operational activities recorded under ID <code>{user.id}</code>.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary"
                    onClick={handleExportActions}
                    disabled={actions.length === 0}
                  >
                    Export Log
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={onClearActions}
                    disabled={actions.length === 0}
                  >
                    Clear History
                  </button>
                </div>
              </div>

              {actions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '8px' }}>📋</span>
                  <strong>No action records yet in this session.</strong>
                  <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                    Actions taken on tickets, orders, or credentials will be logged here.
                  </p>
                </div>
              ) : (
                <div className="settings-actions-timeline">
                  {actions.map((act) => (
                    <div key={act.id} className="settings-action-item">
                      <div className="settings-action-badge">
                        {act.category === 'Auth' && '🔐'}
                        {act.category === 'Ticket' && '🎫'}
                        {act.category === 'Order' && '📦'}
                        {act.category === 'Settings' && '⚙️'}
                        {act.category === 'Resolution' && '✅'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{act.description}</span>
                          <span className="muted small" style={{ fontSize: '0.78rem' }}>
                            {formatDateTime(act.timestamp)}
                          </span>
                        </div>
                        <span className="tag" style={{ fontSize: '0.72rem', marginTop: '4px', display: 'inline-block' }}>
                          {act.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="google-modal-footer">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onSignOut}
            style={{ color: 'var(--bad, #d93025)', borderColor: 'var(--bad, #d93025)', fontWeight: 600 }}
          >
            Sign out of Operator Console
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onClose}
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}

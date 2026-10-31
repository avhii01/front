import { API_URL } from './api';

export type SupportRole =
  | 'Support Specialist'
  | 'Senior Specialist'
  | 'Billing Specialist'
  | 'Logistics Coordinator'
  | 'Operations Admin';

export interface SupportMember {
  id: string;
  name: string;
  email: string;
  role: SupportRole;
  department: string;
  status: 'active' | 'away' | 'offline';
  activeTicketsCount: number;
  addedAt: string;
  password?: string;
  passwordHash?: string;
}

export interface TeamLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: 'member_added' | 'member_updated' | 'member_removed' | 'ticket_assigned' | 'ticket_resolved' | 'status_changed';
  description: string;
  target?: string;
}

const STORAGE_KEY_TEAM = 'relay.support.team';
const STORAGE_KEY_LOGS = 'relay.team.logs';

export const DEFAULT_SUPPORT_TEAM: SupportMember[] = [
  {
    id: 'ADM-9041',
    name: 'Admin Operator',
    email: 'admin.operator@relay.internal',
    role: 'Operations Admin',
    department: 'Customer Operations & Reliability',
    status: 'active',
    activeTicketsCount: 4,
    addedAt: '2026-10-25T08:00:00Z',
    password: 'admin-relay',
  },
  {
    id: 'SPT-1002',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@relay.internal',
    role: 'Senior Specialist',
    department: 'Payments & Billing',
    status: 'active',
    activeTicketsCount: 2,
    addedAt: '2026-10-26T09:15:00Z',
  },
  {
    id: 'SPT-1003',
    name: 'Michael Torres',
    email: 'michael.torres@relay.internal',
    role: 'Support Specialist',
    department: 'Customer Operations',
    status: 'active',
    activeTicketsCount: 3,
    addedAt: '2026-10-27T10:30:00Z',
  },
  {
    id: 'SPT-1004',
    name: 'Elena Rostova',
    email: 'elena.rostova@relay.internal',
    role: 'Logistics Coordinator',
    department: 'Shipping & Logistics',
    status: 'active',
    activeTicketsCount: 1,
    addedAt: '2026-10-28T11:45:00Z',
  },
];

export const DEFAULT_TEAM_LOGS: TeamLogEntry[] = [
  {
    id: 'TL-1001',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actor: 'Admin Operator (ADM-9041)',
    action: 'member_added',
    description: 'Onboarded Elena Rostova as Logistics Coordinator in Shipping & Logistics',
    target: 'Elena Rostova',
  },
  {
    id: 'TL-1002',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    actor: 'Sarah Jenkins (SPT-1002)',
    action: 'ticket_resolved',
    description: 'Permanently resolved case tkt_91ca2f4b for Alice Demo (Stripe webhook reconciliation)',
    target: 'tkt_91ca2f4b',
  },
  {
    id: 'TL-1003',
    timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    actor: 'Michael Torres (SPT-1003)',
    action: 'ticket_assigned',
    description: 'Assigned case tkt_515e3b3a37 to investigation queue',
    target: 'tkt_515e3b3a37',
  },
  {
    id: 'TL-1004',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actor: 'Admin Operator (ADM-9041)',
    action: 'status_changed',
    description: 'Updated shift status: All support specialists active on Tier-1 queue',
  },
];

function notifyTeamUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('relay-team-updated'));
  }
}

let hasInitiatedSync = false;

export async function syncTeamFromBackend(requesterRole?: string, requesterId?: string): Promise<SupportMember[]> {
  if (typeof window === 'undefined') return DEFAULT_SUPPORT_TEAM;
  try {
    const params = new URLSearchParams();
    if (requesterRole) params.append('requester_role', requesterRole);
    if (requesterId) params.append('requester_id', requesterId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/api/team${qs}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return getSupportTeam();
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const mapped: SupportMember[] = data.map((item: {
        id: string;
        name: string;
        email: string;
        role: string;
        department: string;
        status?: string;
        active_tickets_count?: number;
        created_at?: string;
        password?: string;
        password_hash?: string;
      }) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role as SupportRole,
        department: item.department,
        status: (item.status || 'active') as 'active' | 'away' | 'offline',
        activeTicketsCount: item.active_tickets_count ?? 0,
        addedAt: item.created_at || new Date().toISOString(),
        password: item.password ?? undefined,
        passwordHash: item.password_hash,
      }));
      sessionStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(mapped));
      notifyTeamUpdated();
      return mapped;
    }
  } catch {
    // network or backend down, fallback gracefully
  }
  return getSupportTeam();
}

export function getSupportTeam(): SupportMember[] {
  if (typeof window === 'undefined') return DEFAULT_SUPPORT_TEAM;
  if (!hasInitiatedSync) {
    hasInitiatedSync = true;
    void syncTeamFromBackend();
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_TEAM);
    if (!raw) {
      sessionStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(DEFAULT_SUPPORT_TEAM));
      return DEFAULT_SUPPORT_TEAM;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SUPPORT_TEAM;
  } catch {
    return DEFAULT_SUPPORT_TEAM;
  }
}

export function saveSupportTeam(team: SupportMember[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(team));
    notifyTeamUpdated();
  } catch {
    // ignore
  }
}

export function addSupportMember(
  data: Omit<SupportMember, 'id' | 'addedAt' | 'activeTicketsCount'> & { password?: string },
  actorName = 'Admin Operator',
  actorRole = 'Operations Admin',
  actorId = 'ADM-9041',
): SupportMember {
  const current = getSupportTeam();
  const nextNum = 1000 + current.length + 1;
  const rawPassword = data.password?.trim() || 'relay123';
  const newMember: SupportMember = {
    ...data,
    id: `SPT-${nextNum}`,
    addedAt: new Date().toISOString(),
    activeTicketsCount: 0,
    password: rawPassword,
  };
  const updated = [...current, newMember];
  saveSupportTeam(updated);

  // Sync to Neon PostgreSQL
  void fetch(`${API_URL}/api/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: newMember.id,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      department: newMember.department,
      status: newMember.status,
      active_tickets_count: newMember.activeTicketsCount,
      password: newMember.password,
      requester_role: actorRole,
      requester_id: actorId,
    }),
  }).catch(() => {});

  logTeamActivity(
    'member_added',
    `Added ${newMember.name} (${newMember.role}) to ${newMember.department} support roster`,
    actorName,
    newMember.name,
  );

  return newMember;
}

export function updateSupportMember(
  id: string,
  patch: Partial<SupportMember>,
  actorName = 'Admin Operator',
): void {
  const current = getSupportTeam();
  let memberName = '';
  const updated = current.map((m) => {
    if (m.id === id) {
      memberName = m.name;
      return { ...m, ...patch };
    }
    return m;
  });
  saveSupportTeam(updated);

  // Sync to Neon PostgreSQL
  void fetch(`${API_URL}/api/team/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: patch.name,
      role: patch.role,
      department: patch.department,
      status: patch.status,
      active_tickets_count: patch.activeTicketsCount,
    }),
  }).catch(() => {});

  if (memberName) {
    logTeamActivity(
      'member_updated',
      `Updated profile/status for ${memberName} (${id})`,
      actorName,
      memberName,
    );
  }
}

export function removeSupportMember(
  id: string,
  actorName = 'Admin Operator',
  actorRole = 'Operations Admin',
  actorId = 'ADM-9041',
): void {
  const current = getSupportTeam();
  const target = current.find((m) => m.id === id);
  const updated = current.filter((m) => m.id !== id);
  saveSupportTeam(updated);

  // Sync to Neon PostgreSQL with requester credentials
  void fetch(`${API_URL}/api/team/${id}?requester_role=${encodeURIComponent(actorRole)}&requester_id=${encodeURIComponent(actorId)}`, {
    method: 'DELETE',
  }).catch(() => {});

  if (target) {
    logTeamActivity(
      'member_removed',
      `Removed ${target.name} (${target.role}) from active support roster`,
      actorName,
      target.name,
    );
  }
}

export function getTeamLogs(): TeamLogEntry[] {
  if (typeof window === 'undefined') return DEFAULT_TEAM_LOGS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) {
      sessionStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(DEFAULT_TEAM_LOGS));
      return DEFAULT_TEAM_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_TEAM_LOGS;
  } catch {
    return DEFAULT_TEAM_LOGS;
  }
}

export function logTeamActivity(
  action: TeamLogEntry['action'],
  description: string,
  actor = 'Admin Operator',
  target?: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getTeamLogs();
    const newEntry: TeamLogEntry = {
      id: `TL-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      description,
      target,
    };
    const updated = [newEntry, ...current].slice(0, 100);
    sessionStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
    notifyTeamUpdated();
  } catch {
    // ignore
  }
}

export function clearTeamLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify([]));
    notifyTeamUpdated();
  } catch {
    // ignore
  }
}

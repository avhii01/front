import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsModal, type AdminUser } from './SettingsModal';

const adminUser: AdminUser = {
  id: 'ADM-9041',
  name: 'Admin Operator',
  email: 'admin.operator@relay.internal',
  role: 'Operations Admin',
  department: 'Customer Operations & Reliability',
  loginTime: '2026-10-31T10:00:00Z',
};

const supportUser: AdminUser = {
  id: 'SPT-1002',
  name: 'Sarah Jenkins',
  email: 'sarah.jenkins@relay.internal',
  role: 'Senior Specialist',
  department: 'Payments & Billing',
  loginTime: '2026-10-31T10:00:00Z',
};

describe('SettingsModal Role-Based Password Visibility', () => {
  it('does NOT display passwords to a non-admin support team member', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        user={supportUser}
        initialTab="team"
        onUpdateUser={() => {}}
      />
    );

    // Non-admin should see team members and IDs
    expect(screen.getByText('Sarah Jenkins')).toBeTruthy();
    expect(screen.getByText('Michael Torres')).toBeTruthy();

    // Non-admin MUST NOT see passwords of any team members
    expect(screen.queryByText(/🔑 Password:/i)).toBeNull();
    expect(screen.queryByText(/admin-relay/i)).toBeNull();
  });

  it('displays passwords to an administrator', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        user={adminUser}
        initialTab="team"
        onUpdateUser={() => {}}
      />
    );

    // Admin should see team members and passwords
    expect(screen.getByText('Admin Operator')).toBeTruthy();
    const passwords = screen.getAllByText(/🔑 Password:/i);
    expect(passwords.length).toBeGreaterThan(0);
    expect(screen.getByText(/admin-relay/i)).toBeTruthy();
  });
});

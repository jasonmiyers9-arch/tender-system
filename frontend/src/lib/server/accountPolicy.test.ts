import { describe, expect, it, vi } from 'vitest';
import {
  accountAccessDetail,
  hashPassword,
  initialVerificationStatus,
  readLocalDevSession,
  resolveRegistrationRole,
  signLocalDevSession,
  verifyStoredPassword,
} from './accountPolicy';

describe('registration roles', () => {
  it('refuses public admin and super-admin roles', () => {
    expect(() => resolveRegistrationRole('admin')).toThrow('admin_registration_disabled');
    expect(() => resolveRegistrationRole(' super_admin ')).toThrow('admin_registration_disabled');
    expect(() => resolveRegistrationRole('SUPER_ADMIN')).toThrow('admin_registration_disabled');
  });

  it('maps public company and evaluator roles only', () => {
    expect(resolveRegistrationRole('company')).toBe('user');
    expect(resolveRegistrationRole('user')).toBe('user');
    expect(resolveRegistrationRole('tender_provider')).toBe('evaluator');
    expect(resolveRegistrationRole('evaluator')).toBe('evaluator');
    expect(resolveRegistrationRole('mystery')).toBe('user');
  });

  it('allows privileged provisioning to create admins', () => {
    expect(resolveRegistrationRole('admin', true)).toBe('admin');
    expect(resolveRegistrationRole('super_admin', true)).toBe('super_admin');
  });
});

describe('account approval', () => {
  it('blocks pending and rejected accounts', () => {
    expect(accountAccessDetail({ verificationStatus: 'pending' })).toBe('account_pending');
    expect(accountAccessDetail({ verificationStatus: 'rejected' })).toBe('account_rejected');
    expect(accountAccessDetail({ verificationStatus: 'approved', isActive: false })).toBe('account_inactive');
    expect(accountAccessDetail({ verificationStatus: 'approved' })).toBeNull();
  });

  it('keeps production self-serve accounts pending', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(initialVerificationStatus(false)).toBe('pending');
    expect(initialVerificationStatus(true)).toBe('approved');
    vi.unstubAllEnvs();
  });
});

describe('local development sessions', () => {
  it('does not accept a raw user id as a bearer token', () => {
    expect(readLocalDevSession('demo-admin')).toBeNull();
    expect(readLocalDevSession('local.demo-admin.forged')).toBeNull();
    const token = signLocalDevSession('demo-admin');
    expect(token).not.toBe('demo-admin');
    expect(readLocalDevSession(token)).toBe('demo-admin');
  });
});

describe('password storage', () => {
  it('stores a verifier that is not the password', () => {
    const stored = hashPassword('correct horse battery');
    expect(stored).not.toContain('correct horse');
    expect(verifyStoredPassword('correct horse battery', stored)).toBe(true);
    expect(verifyStoredPassword('wrong', stored)).toBe(false);
    expect(verifyStoredPassword('correct horse battery', 'correct horse battery')).toBe(false);
    expect(verifyStoredPassword('correct horse battery', '')).toBe(false);
  });
});

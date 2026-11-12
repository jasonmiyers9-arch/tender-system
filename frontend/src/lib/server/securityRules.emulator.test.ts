import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const enabled = process.env.RUN_RULES_EMULATOR === '1';
const describeRules = enabled ? describe : describe.skip;

describeRules('Firebase emulator rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-tenderguard-rules',
      firestore: {
        rules: readFileSync(path.resolve(__dirname, '../../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
      storage: {
        rules: readFileSync(path.resolve(__dirname, '../../../storage.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  it('blocks a signed-in contractor from reading or writing company data', async () => {
    const db = env.authenticatedContext('contractor-1', { role: 'user' }).firestore();
    await assertFails(getDoc(doc(db, 'companies/acme')));
    await assertFails(setDoc(doc(db, 'companies/acme'), { status: 'verified' }));
    await assertFails(setDoc(doc(db, 'users/contractor-1'), { role: 'super_admin' }));
  });

  it('blocks an anonymous client and allows an admin claim to read the audit log', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'audit_log/event-1')));

    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_log/event-1'), { action: 'seed' });
    });

    const admin = env.authenticatedContext('admin-1', { role: 'admin' }).firestore();
    await assertSucceeds(getDoc(doc(admin, 'audit_log/event-1')));
    await assertFails(setDoc(doc(admin, 'audit_log/event-1'), { action: 'tamper' }));
  });
});

describe('rules emulator harness', () => {
  it('is opt-in so unit tests do not require Java', () => {
    expect(typeof enabled).toBe('boolean');
  });
});

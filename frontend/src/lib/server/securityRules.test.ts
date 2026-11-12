import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const firestoreRules = readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const storageRules = readFileSync(path.join(root, 'storage.rules'), 'utf8');

describe('Firestore security rules', () => {
  it('denies client access by default and gates audit reads on server-set role claims', () => {
    expect(firestoreRules).toContain('request.auth.token.role');
    expect(firestoreRules).toContain("allow read, write: if false");
    expect(firestoreRules).not.toMatch(/allow\s+read,\s*write:\s*if\s+true/);
    expect(firestoreRules).toContain('allow create, update, delete: if false');
    expect(firestoreRules).toContain("match /companies/{companyId}");
    expect(firestoreRules).toContain("match /users/{userId}");
  });
});

describe('Storage security rules', () => {
  it('denies client reads and writes of compliance files', () => {
    expect(storageRules).toContain('allow read, write: if false');
    expect(storageRules).not.toMatch(/allow\s+read,\s*write:\s*if\s+true/);
    expect(storageRules).toContain('match /companies/{companyId}/{allPaths=**}');
  });
});

# Firebase Production Setup

Tender Guard Pro uses Firebase Auth, Cloud Firestore, and Cloud Storage as its production backend. The application fails closed in production if Firebase persistence is unavailable.

## Required deployment variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `CRON_SECRET`
- `ALLOW_LOCAL_STORAGE_FALLBACK=false`

Keep service-account credentials in the deployment provider's encrypted environment settings. Do not commit them.

## Deploy rules and indexes

From `frontend/`, authenticate the Firebase CLI and select the production project:

```bash
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Direct client access to Firestore and Storage is denied. Application data and signed document URLs are served through authenticated Next.js API routes using Firebase Admin.

## Firebase console controls

1. Enable Email/Password authentication and approved OAuth providers.
2. Restrict authorized domains to production and approved staging domains.
3. Enable App Check for supported browser-facing Firebase services.
4. Enable Firestore point-in-time recovery and schedule backups according to the retention policy.
5. Configure a Firestore TTL policy on `rate_limits.expiresAt`.
6. Configure budget alerts, usage alerts, and audit-log export.
7. Use separate Firebase projects for development, staging, and production.
8. Rotate the Firebase service-account key and `CRON_SECRET` on a documented schedule.

## Required release checks

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Verify admin authentication, POPIA export/deletion, signed document downloads, scheduled-job records, notification delivery, and backup restoration in staging before production launch.

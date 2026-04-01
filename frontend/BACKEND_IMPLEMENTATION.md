# Serverless Backend Implementation — Firebase + Netlify

## Overview

The TenderGuard Pro system has been successfully migrated from a Python FastAPI backend to a **Netlify-compatible serverless architecture** with **Firebase Firestore** for metadata and **Firebase Authentication** for user management.

## Architecture

```
Frontend (Next.js 16 + React 19)
    ↓
Route Handlers (/app/api/*)
    ↓
Firestore Service Layer (/lib/server/firestoreService.ts)
    ↓
Firebase Admin SDK (Server-side)
    ↓
Firestore Database (Metadata)
    ├─ users
    ├─ companies
    ├─ tenders
    ├─ applications
    └─ documents

Client-side:
    ↓
Firebase Web SDK (Client-side)
    ↓
Google Auth Provider + Email/Password Auth
```

## Project Structure

### New Files Created

**Server-side (Backend):**
- `frontend/src/lib/server/firebaseAdmin.ts` — Firebase Admin initialization and token verification
- `frontend/src/lib/server/firestoreService.ts` — Core data layer with Firestore + memory fallback
- `frontend/src/lib/server/mockData.ts` — Default seeded data for local dev
- `frontend/src/lib/firebaseClient.ts` — Client-side Firebase auth setup

**Routes:**
- `frontend/src/app/api/auth/login/` — Email/password authentication
- `frontend/src/app/api/auth/register/` — User registration
- `frontend/src/app/api/auth/google/` — Google sign-in callback
- `frontend/src/app/api/auth/me/` — Current user info + profile update
- `frontend/src/app/api/companies/` — Company management
- `frontend/src/app/api/tenders/` — Tender catalog + readiness scoring
- `frontend/src/app/api/applications/` — Tender application lifecycle
- `frontend/src/app/api/documents/` — Document upload + verification
- `frontend/src/app/api/score/` — Compliance scoring
- `frontend/src/app/api/notifications/` — Alert management

### Updated Files

- `frontend/package.json` — Added `firebase` and `firebase-admin` dependencies
- `frontend/src/lib/api/auth.ts` — Added `googleSignIn()` method
- `frontend/src/app/(auth)/login/page.tsx` — Added Google sign-in button
- `netlify.toml` — Deployment configuration

## Authentication Flow

### Email/Password Login
1. User submits credentials → `POST /api/auth/login`
2. Server retrieves user from Firestore by email
3. Password compared in-memory (plaintext in demo; use bcrypt in production)
4. Returns JWT token (user's Firestore ID) + user object
5. Client stores token in localStorage + Zustand store

### Google Sign-In
1. User clicks "Sign in with Google" → Firebase Web SDK popup
2. Google redirects with ID token → `POST /api/auth/google`
3. Server verifies ID token with Firebase Admin Auth
4. Server creates user in Firestore if first login
5. Returns session token + user object

### Token Validation
- All protected routes extract token from `Authorization: Bearer {token}` header
- Token = Firestore user ID (can be replaced with proper JWT later)
- Example: `const token = parseToken(req); const user = await getUserByToken(token);`

## Firestore Schema

### Collections

**`users`** — User accounts
```typescript
{
  id: string;
  email: string;
  password: string; // plaintext in demo
  fullName: string;
  role: 'user' | 'evaluator' | 'admin';
  verificationStatus: 'approved' | 'pending' | 'rejected';
  activeCompanyId: string | null;
  companyId: string | null;
  createdAt: string; // ISO timestamp
}
```

**`companies`** — Organization profiles
```typescript
{
  id: string;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  status: 'verified' | 'pending' | 'rejected';
  address: string;
  phone: string;
  email: string;
  website: string;
  industry: string;
  incorporatedDate: string; // YYYY-MM-DD
  memberIds: string[]; // array of user IDs
}
```

**`tenders`** — Tender opportunities
```typescript
{
  id: string;
  title: string;
  organization: string;
  deadline: string; // ISO date
  value: string; // e.g. "R 1.8M"
  category: string;
  description: string;
  requirements: string[];
  recommendedDocuments: string[];
  eligibilityCriteria: string[];
  location: string;
  matchScore: number;
  gaps: string[];
  status: string;
  isSystem: boolean;
}
```

**`applications`** — Tender submissions
```typescript
{
  id: string;
  tenderId: string;
  companyId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  documents: string[]; // array of document IDs
  createdAt: string;
}
```

**`documents`** — Uploaded compliance documents
```typescript
{
  id: string;
  companyId: string;
  name: string;
  category: 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration';
  status: 'uploaded' | 'verified' | 'rejected' | 'expired';
  fileUrl: string | null;
  expiryDate: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}
```

## Deployment

### Local Development
```bash
cd frontend
npm install
npm run dev
```
- Runs on `http://localhost:3000`
- Uses in-memory fallback if Firebase not configured
- Routes available at `/api/*`

### Netlify Production
```bash
# .env variables set in Netlify dashboard
npm run build
npm start
```
- Serverless functions auto-deployed from `/app/api` routes
- Static site hosted on Netlify CDN
- Environment variables loaded from Netlify dashboard

## Next Steps: RAG/PDF Ingestion Pipeline

### Phase 2: Document Intelligence

1. **PDF Upload Handler**
   - Route: `POST /api/documents/upload`
   - Accept multipart form data (PDF file)
   - Store in Firebase Storage or cloud bucket
   - Extract text and metadata with pdfjs or Tesseract

2. **Vector Embeddings**
   - Chunk PDF text into 1K-token segments
   - Call OpenAI Embeddings API (or open-source alternative)
   - Store vectors in Firestore or Pinecone/Weaviate

3. **RAG Query Engine**
   - Route: `POST /api/documents/search`
   - Convert user query to vector embedding
   - Similarity search across company document vectors
   - Return ranked chunks as context for LLM

4. **AI Tender Readiness**
   - Route: `GET /api/tenders/{id}/ai-readiness`
   - Fetch tender requirements as query
   - Use RAG to find matching company documents
   - Run through LLM to assess gap + risk score
   - Return enhanced readiness with AI explanations

### Tech Stack Recommendation
- **PDF Processing**: `pdfjs-dist` + `pdf-parse`
- **Vector DB**: Pinecone (managed) or Weaviate (self-hosted)
- **Embeddings**: OpenAI API (`text-embedding-3-small`)
- **LLM**: OpenAI GPT-4o or Claude Haiku for cost efficiency

### Example RAG Flow
```
User uploads: tax_cert_2025.pdf
    ↓
Extract text + chunk into 1K-token segments
    ↓
Call OpenAI embeddings v3 → store vectors in Pinecone
    ↓
User views tender requirements: "Tax compliance + BEE certificate"
    ↓
Convert to embedding → search Pinecone for similar doc chunks
    ↓
Return top-3 matches to LLM: "Here are the company's tax & compliance docs"
    ↓
LLM response: "Tax cert valid until 2027 (✓). BEE certificate missing (✗). Risk: 35%"
    ↓
Display in UI with confidence score + explanation
```

## Security Considerations

### Current Demo State (Not Production-Ready)
- ✗ Passwords stored plaintext
- ✗ Tokens are user IDs (predictable)
- ✗ No rate limiting
- ✗ No CORS protection
- ✗ No audit logging

### Production Hardening
1. **Authentication**
   - Use bcrypt for password hashing
   - Replace token with signed JWT (exp: 1 hour, refresh: 7 days)
   - Implement MFA for admin accounts

2. **Authorization**
   - Add row-level security in Firestore rules
   - Validate user.companyId against document owner
   - Implement role-based access control (RBAC)

3. **Infrastructure**
   - Enable Firestore backup + versioning
   - Set up VPC + private network
   - Use Netlify secrets manager for sensitive env vars
   - Enable Web Application Firewall (WAF)

4. **Compliance**
   - Audit logging to Cloud Logging
   - Data encryption at rest + in transit
   - DPIA for POPIA compliance (SA data privacy)
   - Regular penetration testing

## Development Checklist

- [ ] Firebase project set up + credentials configured
- [ ] Google OAuth app created + redirect URIs added
- [ ] Netlify project created + connected to repo
- [ ] Environment variables added to Netlify dashboard
- [ ] Test email/password login in local dev
- [ ] Test Google sign-in in local dev
- [ ] Test tender list + readiness scoring
- [ ] Test application submission + document upload
- [ ] Test admin verification workflow
- [ ] Deploy to Netlify staging environment
- [ ] Smoke test all flows in staging
- [ ] Set up error tracking (Sentry)
- [ ] Set up analytics (Hotjar)
- [ ] Launch to production

## Troubleshooting

### Firebase not initialized
- Check `.env.local` file exists with all `NEXT_PUBLIC_FIREBASE_*` vars
- Run `npm install firebase firebase-admin` again
- Clear `.next` folder and rebuild

### "Cannot find module 'firebase-admin'"
- This is expected in client-side bundle — only imported in `/app/api` routes
- Server routes execute in Node.js runtime (not browser)

### Google sign-in redirect fails
- Verify redirect URI in Firebase Console: `https://your-domain.com/`
- OAuth consent screen must be configured
- App must be in production or test mode (no localhost block)

### Firestore permission denied
- Check Firestore rules allow read/write for authenticated users
- Verify service account credentials are correct
- Check collection names match exactly (case-sensitive)

## API Reference

### Authentication
- `POST /api/auth/login` — Email/password sign-in
- `POST /api/auth/register` — Create account
- `POST /api/auth/google` — Google sign-in callback
- `GET /api/auth/me` — Current user (requires token)
- `PATCH /api/auth/me` — Update profile

### Companies
- `GET /api/companies` — List user's companies
- `GET /api/companies/active` — Get active company
- `POST /api/companies/switch` — Switch active company
- `GET /api/companies/onboarding/status` — Onboarding progress
- `POST /api/companies/onboarding` — Submit onboarding

### Tenders
- `GET /api/tenders` — List all tenders
- `GET /api/tenders/{id}` — Tender details
- `GET /api/tenders/{id}/readiness` — Readiness scoring
- `GET /api/tenders/calendar` — Upcoming deadlines
- `GET /api/tenders/calendar.ics` — iCal export

### Applications
- `GET /api/applications` — List company applications
- `GET /api/applications/{id}` — Application details
- `POST /api/applications/{id}` — Submit action (body: `{action: "submit"}`)

### Documents
- `GET /api/documents` — List company documents
- `GET /api/documents/{id}` — Document details
- `POST /api/documents/{id}` — Verify action (body: `{action: "verify"}`, admin only)

### Score & Notifications
- `GET /api/score/current` — Current compliance score
- `GET /api/score/history` — Score over time
- `GET /api/notifications` — Notification list
- `POST /api/notifications/{id}/read` — Mark as read
- `POST /api/notifications/mark-all-read` — Bulk read

## Quick Start

1. **Set up Firebase**
   ```bash
   # 1. Go to firebase.google.com
   # 2. Create new project
   # 3. Enable Authentication (Email + Google)
   # 4. Create Firestore database (Start in test mode)
   # 5. Download service account JSON
   # 6. Copy keys to .env.local
   ```

2. **Install & run**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Edit .env.local with your Firebase credentials
   npm run dev
   ```

3. **Test flow**
   - Visit http://localhost:3000/login
   - Try "Demo login" or register new account
   - View tenders + submit application
   - Check readiness scoring

4. **Deploy**
   ```bash
   git add .
   git commit -m "Serverless backend + Firebase auth"
   git push origin main
   # Netlify auto-deploys on push
   ```

---

**Status**: ✅ Core backend complete. Ready for Phase 2: RAG/PDF intelligence.

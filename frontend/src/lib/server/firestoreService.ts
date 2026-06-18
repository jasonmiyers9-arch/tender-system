import { DOCUMENT_CATEGORY_GROUPS } from '@/lib/api/types';
import type { AuthUser, Company, DocumentCategory, TenderDetail, TenderMatch, TenderReadiness, TenderReadinessScoreBreakdown } from '@/lib/api/types';
import { getFirestore, isFirestoreAvailable, verifyIdToken } from './firebaseAdmin';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_COMPANIES, DEFAULT_TENDERS, DEFAULT_USERS, DEFAULT_APPLICATIONS, DEFAULT_DOCUMENTS, InternalCompany, InternalTender, InternalUser, InternalApplication, InternalDocument } from './mockData';
import { calculateTenderReadinessScore, type CompanyProfileFields, type DocumentWithAnalysis } from './complianceScoring';
import { getExpiredInPast12Months, isNewAccount } from './expiryCheckService';
import { sendNotificationDeliveries } from './notificationDelivery';

// Re-export internal types for use by other services
export type { InternalDocument, InternalCompany, InternalTender, InternalUser, InternalApplication };

const USERS_COLLECTION = 'users';
const COMPANIES_COLLECTION = 'companies';
const TENDERS_COLLECTION = 'tenders';
const APPLICATIONS_COLLECTION = 'applications';
const DOCUMENTS_COLLECTION = 'documents';
const ANALYST_RUNS_COLLECTION = 'analyst_runs';
const ANALYST_EVENTS_COLLECTION = 'analyst_events';
const NOTIFICATIONS_COLLECTION = 'notifications';
const TENDER_MATCHES_COLLECTION = 'tender_matches';
const SCORE_HISTORY_COLLECTION = 'score_history';
const SAVED_SEARCHES_COLLECTION = 'saved_searches';
const SCHEDULED_JOB_RUNS_COLLECTION = 'scheduled_job_runs';
const SHOULD_SEED_FIRESTORE_DEMO_DATA = process.env.ENABLE_FIRESTORE_DEMO_SEED === 'true';

function createId() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }

  return value;
}

const LOCAL_AUTH_DB_PATH = path.join(process.cwd(), 'storage', 'local-auth-db.json');

async function hydrateLocalAuthUsers(): Promise<void> {
  if (isFirestoreAvailable()) return;
  try {
    if (!existsSync(LOCAL_AUTH_DB_PATH)) return;
    const raw = await readFile(LOCAL_AUTH_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { users?: InternalUser[]; companies?: InternalCompany[] };
    if (Array.isArray(parsed.users)) {
      const byId = new Map(MEMORY_DB.users.map((user) => [user.id, user]));
      for (const user of parsed.users) {
        if (user && typeof user.id === 'string') {
          byId.set(user.id, user);
        }
      }
      MEMORY_DB.users = [...byId.values()];
    }
    if (Array.isArray(parsed.companies)) {
      const byId = new Map(MEMORY_DB.companies.map((company) => [company.id, company]));
      for (const company of parsed.companies) {
        if (company && typeof company.id === 'string') {
          byId.set(company.id, company);
        }
      }
      MEMORY_DB.companies = [...byId.values()];
    }
  } catch {
    // Best-effort local persistence only.
  }
}

async function persistLocalAuthUsers(): Promise<void> {
  if (isFirestoreAvailable()) return;
  try {
    await mkdir(path.dirname(LOCAL_AUTH_DB_PATH), { recursive: true });
    await writeFile(
      LOCAL_AUTH_DB_PATH,
      JSON.stringify({ users: MEMORY_DB.users, companies: MEMORY_DB.companies }, null, 2),
      'utf8',
    );
  } catch {
    // Best-effort local persistence only.
  }
}

function mapUserToAuthUser(user: InternalUser): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    verificationStatus: user.verificationStatus,
    onboardingCompleted: user.role !== 'user',
  };
}

const PRIORITY_ONBOARDING_DOCUMENTS = [
  'bbbee_certificate',
  'sars_pin',
  'cipc_registration',
] as const;

async function getUserOnboardingStatus(user: InternalUser): Promise<{
  completed: boolean;
  checks: Record<string, boolean>;
  documentsUploaded: number;
  requiredDocuments: number;
}> {
  if (user.role !== 'user') {
    return {
      completed: true,
      checks: {},
      documentsUploaded: 0,
      requiredDocuments: 0,
    };
  }

  const companyId = user.activeCompanyId ?? user.companyId;
  if (!companyId) {
    return {
      completed: false,
      checks: {
        csd_number: false,
        bbbee_level: false,
        industry_sector: false,
        province: false,
        bbbee_certificate: false,
        sars_pin: false,
        cipc_registration: false,
      },
      documentsUploaded: 0,
      requiredDocuments: PRIORITY_ONBOARDING_DOCUMENTS.length,
    };
  }

  const [company, documents] = await Promise.all([
    getCompanyById(companyId),
    listDocumentsForCompany(companyId),
  ]);
  const profileChecks = {
    csd_number: Boolean(company?.csdNumber),
    bbbee_level: Boolean(company?.bbbeeLevel),
    industry_sector: Boolean(company?.industry),
    province: Boolean(company?.province),
  };
  const uploadedCategories = new Set(documents.map((doc) => doc.category));
  const documentChecks = Object.fromEntries(
    PRIORITY_ONBOARDING_DOCUMENTS.map((category) => [category, uploadedCategories.has(category)])
  ) as Record<string, boolean>;
  const checks = {
    ...profileChecks,
    ...documentChecks,
  };

  return {
    completed: Object.values(checks).every(Boolean),
    checks,
    documentsUploaded: Object.values(documentChecks).filter(Boolean).length,
    requiredDocuments: PRIORITY_ONBOARDING_DOCUMENTS.length,
  };
}

async function mapUserToAuthUserWithOnboarding(user: InternalUser): Promise<AuthUser> {
  const authUser = mapUserToAuthUser(user);
  const onboarding = await getUserOnboardingStatus(user);
  return {
    ...authUser,
    onboardingCompleted: onboarding.completed,
  };
}

function mapCompanyToPublic(company: InternalCompany): Company {
  return {
    id: company.id,
    name: company.name,
    registrationNumber: company.registrationNumber,
    vatNumber: company.vatNumber,
    status: company.status,
    address: company.address,
    phone: company.phone,
    email: company.email,
    website: company.website,
    industry: company.industry,
    incorporatedDate: company.incorporatedDate,
    csdNumber: company.csdNumber ?? null,
    bbbeeLevel: company.bbbeeLevel ?? null,
    cidbGrade: company.cidbGrade ?? null,
    province: company.province ?? null,
    tenderCategories: company.tenderCategories ?? [],
  };
}

function buildCompanyFromUser(user: InternalUser): Company | null {
  const companyId = user.companyId ?? user.activeCompanyId;
  const companyName = user.companyName?.trim();
  if (!companyId || !companyName) {
    return null;
  }

  return {
    id: companyId,
    name: companyName,
    registrationNumber: user.registrationNumber ?? '',
    vatNumber: '',
    status: 'verified',
    address: '',
    phone: user.phone ?? '',
    email: user.email,
    website: '',
    industry: '',
    incorporatedDate: user.createdAt.slice(0, 10),
    tenderCategories: [],
  };
}

function mapTenderToMatch(tender: InternalTender): TenderMatch {
  return {
    id: tender.id,
    title: tender.title,
    organization: tender.organization,
    deadline: tender.deadline,
    value: tender.value,
    matchScore: tender.matchScore,
    gaps: tender.gaps,
    category: tender.category,
    location: tender.location,
    description: tender.description,
    requirements: tender.requirements,
    eligibilityCriteria: tender.eligibilityCriteria,
    recommendedDocuments: tender.recommendedDocuments,
    required_categories: tender.required_categories || [],
    rejectionReason: tender.rejectionReason ?? undefined,
    createdBy: tender.createdBy,
    status: tender.status ?? 'draft',
    createdAt: tender.createdAt ?? new Date().toISOString(),
    advertised: tender.advertised,
    closingTime: tender.closingTime,
    sourceUrl: tender.sourceUrl,
    sourceSite: tender.sourceSite,
    tenderNumber: tender.tenderNumber,
    tenderType: tender.tenderType,
    province: tender.province,
    specialConditions: tender.specialConditions,
    briefing: tender.briefing,
    contact: tender.contact,
    requiredAt: tender.location,
    isScraped: Boolean(tender.sourceSite || tender.sourceUrl),
  };
}

function mapTenderToDetail(tender: InternalTender): TenderDetail {
  return {
    ...mapTenderToMatch(tender),
    description: tender.description,
    requirements: tender.requirements,
    recommendedDocuments: tender.recommendedDocuments,
    eligibilityCriteria: tender.eligibilityCriteria,
  };
}

function buildReadiness(tender: InternalTender): TenderReadiness {
  // Fallback when no company context available - simple placeholder
  const requiredCategories = tender.recommendedDocuments.length > 0 ? tender.recommendedDocuments : tender.requirements.slice(0, 3);
  const missingCategories = requiredCategories.map((category) => category.toLowerCase().split(' ')[0]);
  const checklist = missingCategories.map((category) => ({
    item: `${category} document available`,
    status: 'missing' as const,
  }));

  return {
    tenderId: tender.id,
    readyToSubmit: false,
    readinessScore: Math.max(20, 100 - missingCategories.length * 20),
    blockers: missingCategories.map((category) => `Missing required ${category} document`),
    missingCategories,
    gaps: missingCategories.map((category) => `Missing ${category} document`),
    recommendedDocuments: missingCategories,
    checklist,
  };
}

/**
 * Build tender readiness with full company context and weighted scoring
 * Uses Section 4.4 Tender Readiness Score™ calculation
 */
async function buildReadinessWithCompany(
  tender: InternalTender,
  companyId: string,
  company?: Company
): Promise<TenderReadiness> {
  // Get company documents
  const documents = await listDocumentsForCompany(companyId);
  
  // Get company profile for CSD completeness check
  const profile: CompanyProfileFields = {
    name: company?.name,
    registrationNumber: company?.registrationNumber ?? '',
    vatNumber: company?.vatNumber ?? '',
    industry: company?.industry ?? '',
    province: company?.province ?? undefined,
    bbbeeLevel: company?.bbbeeLevel ? parseInt(company.bbbeeLevel, 10) : undefined,
    cidbGrade: company?.cidbGrade ?? undefined,
  };
  
  // Get expiry history for compliance consistency
  const expiredCount = await getExpiredInPast12Months(companyId);
  const isNew = await isNewAccount(companyId);
  
  // Build tender requirements from tender data
  const tenderRequirements = {
    requiredCategories: tender.required_categories ?? tender.recommendedDocuments ?? [],
    preferredCategories: [] as string[],
  };
  
  // Calculate Tender Readiness Score™
  const docsWithAnalysis: DocumentWithAnalysis[] = documents.map(doc => ({
    ...doc,
    analysis: undefined, // Analysis would be populated if available
  }));
  
  const readinessScore = calculateTenderReadinessScore(
    companyId,
    docsWithAnalysis,
    profile,
    company?.industry,
    expiredCount,
    isNew,
    tenderRequirements
  );
  
  // Derive missing categories from gaps
  const requiredCats = tender.required_categories ?? tender.recommendedDocuments ?? [];
  const docCategories: Set<string> = new Set(documents.map(d => DOCUMENT_CATEGORY_GROUPS[d.category] ?? d.category));
  const missingCategories = requiredCats.filter((cat) => !docCategories.has(DOCUMENT_CATEGORY_GROUPS[cat as DocumentCategory] ?? cat));
  
  // Build checklist based on gaps
  const checklist: Array<{ item: string; status: 'passed' | 'failed' | 'missing' }> = readinessScore.missingForBidReady.map(gap => ({
    item: gap,
    status: 'failed' as const,
  }));
  
  // Add passed items for valid categories
  for (const cat of requiredCats) {
    const doc = documents.find((d) => (DOCUMENT_CATEGORY_GROUPS[d.category] ?? d.category) === (DOCUMENT_CATEGORY_GROUPS[cat as DocumentCategory] ?? cat));
    if (doc && doc.status === 'verified') {
      checklist.unshift({
        item: `${cat.toUpperCase()} document verified`,
        status: 'passed' as const,
      });
    }
  }
  
  const scoreBreakdown: TenderReadinessScoreBreakdown = {
    documentCompleteness: readinessScore.dimensions.documentCompleteness,
    verificationCoverage: readinessScore.dimensions.verificationCoverage,
    csdProfileCompleteness: readinessScore.dimensions.csdProfileCompleteness,
    complianceConsistency: readinessScore.dimensions.complianceConsistency,
    tenderFitBonus: readinessScore.dimensions.tenderFitBonus,
  };
  
  return {
    tenderId: tender.id,
    readyToSubmit: readinessScore.isBidReady,
    readinessScore: readinessScore.totalScore,
    scoreBreakdown,
    isBidReady: readinessScore.isBidReady,
    blockers: readinessScore.missingForBidReady,
    missingCategories,
    gaps: readinessScore.missingForBidReady,
    recommendedDocuments: missingCategories,
    checklist,
  };
}

export interface AnalystRunRecord {
  id: string;
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  trigger: string;
  actorUserId: string | null;
  score: number;
  deterministicScore: number;
  llmDeltaApplied: number;
  confidenceScore: number;
  reasonCodes: string[];
  recommendation: string;
  missingDocuments: string[];
  strengths: string[];
  priorityActions: string[];
  breakdown: {
    documentCompleteness: number;
    documentValidity: number;
    requirementMatch: number;
    verificationStatus: number;
    bonusPoints: number;
  };
  source: 'hybrid' | 'deterministic';
  model: string;
  promptVersion: string;
  companyProfileSnapshot?: {
    overallScore: number;
    documentCount: number;
    missingCategories: string[];
    expiringDocuments: Array<{ documentId: string; documentName: string; category: string; expiryDate: string; daysUntilExpiry: number }>;
    categoryScores: Record<string, { score: number; hasDocument: boolean; isVerified: boolean; isExpired: boolean; expiresInDays: number | null; documentCount: number } | undefined>;
    recommendations: string[];
  };
  createdAt: string;
}

export interface AnalystEventRecord {
  id: string;
  eventType: string;
  companyId: string;
  tenderId: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  companyId: string;
  userId: string | null;
  alertType: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  isRead: boolean;
  triggerDate: string;
  createdAt: string;
  dedupeKey: string;
  delivery?: {
    email: 'pending' | 'sent' | 'skipped' | 'failed';
    sms: 'pending' | 'sent' | 'skipped' | 'failed';
    errors: string[];
    attemptedAt: string | null;
  };
}

export interface TenderMatchRecord {
  id: string;
  tenderId: string;
  tenderTitle: string;
  companyId: string;
  score: number;
  deterministicScore: number;
  llmDeltaApplied: number;
  confidenceScore: number;
  reasonCodes: string[];
  recommendation: string;
  missingDocuments: string[];
  strengths: string[];
  priorityActions: string[];
  source: 'hybrid' | 'deterministic';
  model: string;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreHistoryRecord {
  id: string;
  companyId: string;
  score: number;
  band: 'tender-ready' | 'partially-ready' | 'high-risk';
  completedDocuments: number;
  totalDocuments: number;
  missingDocuments: string[];
  expiringDocuments: string[];
  snapshotDate: string;
  createdAt: string;
}

export interface SavedTenderSearchRecord {
  id: string;
  userId: string;
  companyId: string | null;
  name: string;
  filters: {
    q?: string;
    province?: string;
    category?: string;
    buyer?: string;
    tenderType?: string;
    briefing?: 'any' | 'true' | 'compulsory';
    closingWithin?: number;
    minValue?: number;
    maxValue?: number;
    minScore?: number;
  };
  frequency: 'daily' | 'weekly' | 'paused';
  enabled: boolean;
  lastDeliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledJobRunRecord {
  id: string;
  job: string;
  ok: boolean;
  status: 'success' | 'partial' | 'failed';
  checkedAt: string;
  recordedAt: string;
  errors: string[];
  metrics: Record<string, number | string | boolean | null>;
}

async function ensureFirestoreSeed() {
  if (!isFirestoreAvailable()) return;
  if (!SHOULD_SEED_FIRESTORE_DEMO_DATA) return;
  const db = getFirestore()!;
  const userSnapshot = await db.collection(USERS_COLLECTION).limit(1).get();
  if (!userSnapshot.empty) return;

  for (const user of DEFAULT_USERS) {
    await db.collection(USERS_COLLECTION).doc(user.id).set(user);
  }
  for (const company of DEFAULT_COMPANIES) {
    const { memberIds, ...publicCompany } = company;
    await db.collection(COMPANIES_COLLECTION).doc(company.id).set({ ...publicCompany, memberIds });
  }
  for (const tender of DEFAULT_TENDERS) {
    await db.collection(TENDERS_COLLECTION).doc(tender.id).set(tender);
  }
}

async function getUserDocumentById(userId: string): Promise<InternalUser | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(USERS_COLLECTION).doc(userId).get();
    return snapshot.exists ? (snapshot.data() as InternalUser) : null;
  }

  await hydrateLocalAuthUsers();
  const user = MEMORY_DB.users.find((item) => item.id === userId);
  return user ?? null;
}

export async function getUserByToken(token: string): Promise<InternalUser | null> {
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    return getUserDocumentById(decoded.uid);
  } catch {
    return getUserDocumentById(token);
  }
}

export async function getUserByEmail(email: string): Promise<InternalUser | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
    return snapshot.empty ? null : (snapshot.docs[0].data() as InternalUser);
  }

  await hydrateLocalAuthUsers();
  return MEMORY_DB.users.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function createUser(payload: {
  uid?: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  companyName?: string;
  registrationNumber?: string;
  phone?: string;
  tenderCategories?: string[];
}): Promise<AuthUser> {
  const existing = await getUserByEmail(payload.email);
  if (existing) {
    if (payload.uid && existing.id === payload.uid) {
      return mapUserToAuthUser(existing);
    }
    throw new Error('Email already registered');
  }

  const userId = payload.uid ?? createId();
  const userRole = payload.role === 'super_admin' ? 'super_admin' : payload.role === 'admin' ? 'admin' : payload.role === 'tender_provider' ? 'evaluator' : 'user';
  const companyId = payload.companyName ? createId() : null;

  const userRecord: InternalUser = {
    id: userId,
    email: payload.email,
    password: payload.password ?? '',
    fullName: payload.name,
    role: userRole,
    verificationStatus: 'approved',
    activeCompanyId: companyId,
    companyId,
    companyName: payload.companyName?.trim() || undefined,
    registrationNumber: payload.registrationNumber?.trim() || undefined,
    phone: payload.phone?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).set(userRecord);
    if (companyId) {
      await db.collection(COMPANIES_COLLECTION).doc(companyId).set({
        id: companyId,
        name: payload.companyName ?? 'Untitled Company',
        registrationNumber: payload.registrationNumber ?? '',
        vatNumber: '',
        status: 'verified',
        address: '',
        phone: payload.phone ?? '',
        email: payload.email,
        website: '',
        industry: '',
        incorporatedDate: new Date().toISOString().slice(0, 10),
        memberIds: [userId],
        tenderCategories: payload.tenderCategories ?? [],
      });
    }
  } else {
    MEMORY_DB.users.push(userRecord);
    if (companyId) {
      const companyRecord: InternalCompany = {
        id: companyId,
        name: payload.companyName ?? 'Untitled Company',
        registrationNumber: payload.registrationNumber ?? '',
        vatNumber: '',
        status: 'verified',
        address: '',
        phone: payload.phone ?? '',
        email: payload.email,
        website: '',
        industry: '',
        incorporatedDate: new Date().toISOString().slice(0, 10),
        memberIds: [userId],
        tenderCategories: payload.tenderCategories ?? [],
      };
      MEMORY_DB.companies.push(companyRecord);
    }
    await persistLocalAuthUsers();
  }

  return mapUserToAuthUser(userRecord);
}

async function getOrCreateGoogleUser(payload: {
  uid: string;
  email: string;
  fullName: string;
}): Promise<InternalUser> {
  const existing = await getUserByEmail(payload.email);
  if (existing) {
    return existing;
  }

  const userRecord: InternalUser = {
    id: payload.uid,
    email: payload.email,
    password: '',
    fullName: payload.fullName || payload.email.split('@')[0],
    role: 'user',
    verificationStatus: 'approved',
    activeCompanyId: null,
    companyId: null,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userRecord.id).set(userRecord);
  } else {
    MEMORY_DB.users.push(userRecord);
    await persistLocalAuthUsers();
  }

  return userRecord;
}

async function authenticateUser(email: string, password: string): Promise<InternalUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}

async function updateUserName(userId: string, name: string): Promise<AuthUser> {
  const user = await getUserDocumentById(userId);
  if (!user) throw new Error('User not found');
  user.fullName = name;
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).update({ fullName: name });
  } else {
    await persistLocalAuthUsers();
  }
  return mapUserToAuthUser(user);
}

async function setUserTotpSecret(userId: string, secret: string): Promise<InternalUser> {
  const user = await getUserDocumentById(userId);
  if (!user) throw new Error('User not found');

  user.mfaTotpSecret = secret;
  user.mfaEnabled = false;
  user.mfaEnrolledAt = null;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).set(
      {
        mfaTotpSecret: secret,
        mfaEnabled: false,
        mfaEnrolledAt: null,
      },
      { merge: true }
    );
  } else {
    await persistLocalAuthUsers();
  }

  return user;
}

async function enableUserMfa(userId: string): Promise<InternalUser> {
  const user = await getUserDocumentById(userId);
  if (!user) throw new Error('User not found');

  user.mfaEnabled = true;
  user.mfaEnrolledAt = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).set(
      {
        mfaEnabled: true,
        mfaEnrolledAt: user.mfaEnrolledAt,
      },
      { merge: true }
    );
  } else {
    await persistLocalAuthUsers();
  }

  return user;
}

async function ensureFirebaseUser(payload: {
  uid: string;
  email: string;
  fullName: string;
  role?: string;
  companyName?: string;
  registrationNumber?: string;
  phone?: string;
}): Promise<AuthUser> {
  const existing = await getUserDocumentById(payload.uid);
  if (existing) {
    const updates: Partial<InternalUser> = {};
    if (payload.email && existing.email !== payload.email) updates.email = payload.email;
    if (payload.fullName && existing.fullName !== payload.fullName) updates.fullName = payload.fullName;
    if (payload.companyName && existing.companyName !== payload.companyName) updates.companyName = payload.companyName;
    if (payload.registrationNumber && existing.registrationNumber !== payload.registrationNumber) updates.registrationNumber = payload.registrationNumber;
    if (payload.phone && existing.phone !== payload.phone) updates.phone = payload.phone;
    if (Object.keys(updates).length) {
      if (isFirestoreAvailable()) {
        const db = getFirestore()!;
        await db.collection(USERS_COLLECTION).doc(payload.uid).set(updates, { merge: true });
      } else {
        Object.assign(existing, updates);
        await persistLocalAuthUsers();
      }
      Object.assign(existing, updates);
    }
    return mapUserToAuthUser(existing);
  }

  return createUser({
    uid: payload.uid,
    name: payload.fullName || payload.email.split('@')[0],
    email: payload.email,
    role: payload.role ?? 'company',
    companyName: payload.companyName,
    registrationNumber: payload.registrationNumber,
    phone: payload.phone,
  });
}

async function listCompaniesForUser(userId: string): Promise<Company[]> {
  const user = await getUserDocumentById(userId);

  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(COMPANIES_COLLECTION).where('memberIds', 'array-contains', userId).get();
    const companies = snapshot.docs.map((doc) => mapCompanyToPublic(doc.data() as InternalCompany));
    if (companies.length > 0) {
      return companies;
    }

    const fallbackCompany = user ? buildCompanyFromUser(user) : null;
    return fallbackCompany ? [fallbackCompany] : [];
  }

  const companies = MEMORY_DB.companies.filter((company) => company.memberIds.includes(userId)).map(mapCompanyToPublic);
  if (companies.length > 0) {
    return companies;
  }

  const fallbackCompany = user ? buildCompanyFromUser(user) : null;
  return fallbackCompany ? [fallbackCompany] : [];
}

async function getCompanyById(companyId: string): Promise<Company | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(COMPANIES_COLLECTION).doc(companyId).get();
    if (snapshot.exists) {
      return mapCompanyToPublic(snapshot.data() as InternalCompany);
    }

    const userSnapshot = await db.collection(USERS_COLLECTION).where('companyId', '==', companyId).limit(1).get();
    if (!userSnapshot.empty) {
      return buildCompanyFromUser(userSnapshot.docs[0].data() as InternalUser);
    }
    return null;
  }

  await hydrateLocalAuthUsers();
  const company = MEMORY_DB.companies.find((item) => item.id === companyId);
  if (company) {
    return mapCompanyToPublic(company);
  }

  const user = MEMORY_DB.users.find((item) => item.companyId === companyId);
  return user ? buildCompanyFromUser(user) : null;
}

async function setActiveCompany(userId: string, companyId: string): Promise<Company> {
  const user = await getUserDocumentById(userId);
  if (!user) throw new Error('User not found');
  const company = await getCompanyById(companyId);
  if (!company) throw new Error('Company not found');

  user.activeCompanyId = companyId;
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).update({ activeCompanyId: companyId });
  }

  return company;
}

async function ensureUserCompanyContext(userId: string): Promise<Company | null> {
  const user = await getUserDocumentById(userId);
  if (!user) return null;

  // Only auto-provision for standard company users.
  if (user.role !== 'user') return null;

  const existingCompanies = await listCompaniesForUser(userId);
  if (existingCompanies.length > 0) {
    const fallback = existingCompanies[0];
    if (!user.activeCompanyId) {
      user.activeCompanyId = fallback.id;
      user.companyId = fallback.id;
      if (isFirestoreAvailable()) {
        const db = getFirestore()!;
        await db.collection(USERS_COLLECTION).doc(userId).set(
          {
            activeCompanyId: fallback.id,
            companyId: fallback.id,
          },
          { merge: true }
        );
      }
    }
    return fallback;
  }

  const companyId = createId();
  const today = new Date().toISOString().slice(0, 10);
  const newCompany: InternalCompany = {
    id: companyId,
    name: `${user.fullName || 'My'} Company`,
    registrationNumber: '',
    vatNumber: '',
    status: 'pending',
    address: '',
    phone: '',
    email: user.email,
    website: '',
    industry: '',
    incorporatedDate: today,
    memberIds: [userId],
  };

  user.activeCompanyId = companyId;
  user.companyId = companyId;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(COMPANIES_COLLECTION).doc(companyId).set(newCompany);
    await db.collection(USERS_COLLECTION).doc(userId).set(
      {
        activeCompanyId: companyId,
        companyId,
      },
      { merge: true }
    );
  } else {
    MEMORY_DB.companies.push(newCompany);
  }

  return mapCompanyToPublic(newCompany);
}

async function updateCompanyProfile(companyId: string, payload: Partial<Company>): Promise<Company> {
  const updatedFields: Partial<InternalCompany> = {};
  if (payload.name !== undefined) updatedFields.name = payload.name;
  if (payload.registrationNumber !== undefined) updatedFields.registrationNumber = payload.registrationNumber;
  if (payload.vatNumber !== undefined) updatedFields.vatNumber = payload.vatNumber;
  if (payload.address !== undefined) updatedFields.address = payload.address;
  if (payload.phone !== undefined) updatedFields.phone = payload.phone;
  if (payload.email !== undefined) updatedFields.email = payload.email;
  if (payload.website !== undefined) updatedFields.website = payload.website;
  if (payload.industry !== undefined) updatedFields.industry = payload.industry;
  if (payload.status !== undefined) updatedFields.status = payload.status;
  if (payload.province !== undefined) updatedFields.province = payload.province;
  if (payload.bbbeeLevel !== undefined) updatedFields.bbbeeLevel = payload.bbbeeLevel;
  if (payload.cidbGrade !== undefined) updatedFields.cidbGrade = payload.cidbGrade;
  if (payload.csdNumber !== undefined) updatedFields.csdNumber = payload.csdNumber;
  if (payload.tenderCategories !== undefined) updatedFields.tenderCategories = payload.tenderCategories;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const companyRef = db.collection(COMPANIES_COLLECTION).doc(companyId);
    await companyRef.set(updatedFields, { merge: true });
    const snapshot = await companyRef.get();
    if (!snapshot.exists) throw new Error('Company not found');
    return mapCompanyToPublic(snapshot.data() as InternalCompany);
  }

  const company = MEMORY_DB.companies.find((item) => item.id === companyId);
  if (!company) throw new Error('Company not found');
  Object.assign(company, updatedFields);
  await persistLocalAuthUsers();
  return mapCompanyToPublic(company);
}

async function listCompanyMembers(companyId: string): Promise<InternalUser[]> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(USERS_COLLECTION).where('companyId', '==', companyId).get();
    return snapshot.docs.map((doc) => doc.data() as InternalUser);
  }
  return MEMORY_DB.users.filter((u) => u.companyId === companyId);
}

async function createTender(payload: {
  title: string;
  organization: string;
  deadline: string;
  value: string;
  category: string;
  location: string;
  description: string;
  requirements: string[];
  eligibilityCriteria: string[];
  required_categories?: string[];
  status?: InternalTender['status'];
  createdBy?: string;
  companyId?: string;
  isSystem?: boolean;
  advertised?: string;
  closingTime?: string;
  sourceUrl?: string;
  sourceSite?: string;
  tenderNumber?: string;
  tenderType?: string;
  province?: string;
  specialConditions?: string;
  briefing?: TenderMatch['briefing'];
  contact?: TenderMatch['contact'];
}): Promise<InternalTender> {
  const tenderId = createId();
  const normalizedDeadline = payload.deadline.replace(/\//g, '-');
  const tender: InternalTender = {
    id: tenderId,
    title: payload.title,
    organization: payload.organization,
    deadline: normalizedDeadline,
    value: payload.value,
    category: payload.category,
    location: payload.location,
    description: payload.description,
    requirements: payload.requirements || [],
    eligibilityCriteria: payload.eligibilityCriteria || [],
    recommendedDocuments: payload.required_categories || [],
    required_categories: payload.required_categories || [],
    matchScore: 0,
    gaps: [],
    status: payload.status ?? 'draft',
    createdBy: payload.createdBy,
    companyId: payload.companyId,
    isSystem: payload.isSystem ?? false,
    advertised: payload.advertised,
    closingTime: payload.closingTime,
    sourceUrl: payload.sourceUrl,
    sourceSite: payload.sourceSite,
    tenderNumber: payload.tenderNumber,
    tenderType: payload.tenderType,
    province: payload.province,
    specialConditions: payload.specialConditions,
    briefing: payload.briefing,
    contact: payload.contact,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(TENDERS_COLLECTION).doc(tenderId).set(stripUndefined(tender));
  } else {
    MEMORY_DB.tenders.push(tender);
  }

  return tender;
}

async function getInternalTenderById(tenderId: string): Promise<InternalTender | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(TENDERS_COLLECTION).doc(tenderId).get();
    return snapshot.exists ? (snapshot.data() as InternalTender) : null;
  }
  return MEMORY_DB.tenders.find((item) => item.id === tenderId) ?? null;
}

async function listTenders(options?: {
  createdBy?: string;
  companyId?: string;
  includeSystem?: boolean;
}): Promise<TenderMatch[]> {
  const includeSystem = options?.includeSystem ?? true;

  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(TENDERS_COLLECTION).get();
    let tenders = snapshot.docs.map((doc) => doc.data() as InternalTender);

    if (!includeSystem) {
      tenders = tenders.filter((item) => !item.isSystem);
    }
    if (options?.createdBy) {
      tenders = tenders.filter((item) => item.createdBy === options.createdBy);
    }
    if (options?.companyId) {
      tenders = tenders.filter((item) => item.companyId === options.companyId);
    }

    return tenders.map(mapTenderToMatch);
  }

  let tenders = MEMORY_DB.tenders;
  if (!includeSystem) {
    tenders = tenders.filter((item) => !item.isSystem);
  }
  if (options?.createdBy) {
    tenders = tenders.filter((item) => item.createdBy === options.createdBy);
  }
  if (options?.companyId) {
    tenders = tenders.filter((item) => item.companyId === options.companyId);
  }

  return tenders.map(mapTenderToMatch);
}

async function getTenderById(tenderId: string): Promise<TenderDetail | null> {
  const tender = await getInternalTenderById(tenderId);
  return tender ? mapTenderToDetail(tender) : null;
}

async function getTenderReadiness(tenderId: string, companyId?: string): Promise<TenderReadiness | null> {
  const tender = await getInternalTenderById(tenderId);
  if (!tender) return null;
  
  // If company context available, use full scoring
  if (companyId) {
    const companies = MEMORY_DB.companies;
    const company = companies.find(c => c.id === companyId);
    return buildReadinessWithCompany(tender, companyId, company ? mapCompanyToPublic(company) : undefined);
  }
  
  // Fallback to simple readiness without company context
  return buildReadiness(tender);
}

async function updateTender(
  tenderId: string,
  payload: Partial<Pick<InternalTender,
    'title' |
    'organization' |
    'deadline' |
    'value' |
    'category' |
    'location' |
    'description' |
    'requirements' |
    'eligibilityCriteria' |
    'required_categories' |
    'recommendedDocuments' |
    'advertised' |
    'closingTime' |
    'sourceUrl' |
    'sourceSite' |
    'tenderNumber' |
    'tenderType' |
    'province' |
    'specialConditions' |
    'briefing' |
    'contact' |
    'status'
  >>,
): Promise<InternalTender> {
  const tender = await getInternalTenderById(tenderId);
  if (!tender) throw new Error('Tender not found');

  const updates: Partial<InternalTender> = {};

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.organization !== undefined) updates.organization = payload.organization;
  if (payload.deadline !== undefined) updates.deadline = payload.deadline.replace(/\//g, '-');
  if (payload.value !== undefined) updates.value = payload.value;
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.location !== undefined) updates.location = payload.location;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.requirements !== undefined) updates.requirements = payload.requirements;
  if (payload.eligibilityCriteria !== undefined) updates.eligibilityCriteria = payload.eligibilityCriteria;
  if (payload.advertised !== undefined) updates.advertised = payload.advertised;
  if (payload.closingTime !== undefined) updates.closingTime = payload.closingTime;
  if (payload.sourceUrl !== undefined) updates.sourceUrl = payload.sourceUrl;
  if (payload.sourceSite !== undefined) updates.sourceSite = payload.sourceSite;
  if (payload.tenderNumber !== undefined) updates.tenderNumber = payload.tenderNumber;
  if (payload.tenderType !== undefined) updates.tenderType = payload.tenderType;
  if (payload.province !== undefined) updates.province = payload.province;
  if (payload.specialConditions !== undefined) updates.specialConditions = payload.specialConditions;
  if (payload.briefing !== undefined) updates.briefing = payload.briefing;
  if (payload.contact !== undefined) updates.contact = payload.contact;

  if (payload.required_categories !== undefined) {
    updates.required_categories = payload.required_categories;
    updates.recommendedDocuments = payload.required_categories;
  } else if (payload.recommendedDocuments !== undefined) {
    updates.recommendedDocuments = payload.recommendedDocuments;
    updates.required_categories = payload.recommendedDocuments;
  }

  if (payload.status !== undefined) {
    updates.status = payload.status;
  } else if (tender.status === 'published') {
    // Editing a published tender requires re-approval.
    updates.status = 'pending';
  }

  Object.assign(tender, updates);

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(TENDERS_COLLECTION).doc(tenderId).set(stripUndefined(updates), { merge: true });
  }

  return tender;
}

async function deleteTender(tenderId: string): Promise<void> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(TENDERS_COLLECTION).doc(tenderId).delete();
    return;
  }

  const index = MEMORY_DB.tenders.findIndex((item) => item.id === tenderId);
  if (index !== -1) {
    MEMORY_DB.tenders.splice(index, 1);
  }
}

async function listApplicationsForCompany(companyId: string): Promise<InternalApplication[]> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(APPLICATIONS_COLLECTION).where('companyId', '==', companyId).get();
    return snapshot.docs.map((doc) => doc.data() as InternalApplication);
  }
  return MEMORY_DB.applications.filter((app) => app.companyId === companyId);
}

async function listApplicationsForTenders(tenderIds: string[]): Promise<InternalApplication[]> {
  if (tenderIds.length === 0) return [];
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    // Firestore 'in' operator caps at 30 values per query — chunk if needed.
    const chunks: string[][] = [];
    for (let i = 0; i < tenderIds.length; i += 30) chunks.push(tenderIds.slice(i, i + 30));
    const results = await Promise.all(
      chunks.map((chunk) =>
        db.collection(APPLICATIONS_COLLECTION).where('tenderId', 'in', chunk).get()
      )
    );
    return results.flatMap((snap) => snap.docs.map((doc) => doc.data() as InternalApplication));
  }
  const set = new Set(tenderIds);
  return MEMORY_DB.applications.filter((app) => set.has(app.tenderId));
}

async function getApplicationById(applicationId: string): Promise<InternalApplication | null> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(APPLICATIONS_COLLECTION).doc(applicationId).get();
    return snapshot.exists ? (snapshot.data() as InternalApplication) : null;
  }
  return MEMORY_DB.applications.find((app) => app.id === applicationId) ?? null;
}

async function createApplication(payload: {
  tenderId: string;
  companyId: string;
  userId: string;
}): Promise<InternalApplication> {
  const appId = createId();
  const application: InternalApplication = {
    id: appId,
    tenderId: payload.tenderId,
    companyId: payload.companyId,
    userId: payload.userId,
    status: 'draft',
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: [],
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(APPLICATIONS_COLLECTION).doc(appId).set(application);
  } else {
    MEMORY_DB.applications.push(application);
  }

  return application;
}

async function submitApplication(applicationId: string): Promise<InternalApplication> {
  const app = await getApplicationById(applicationId);
  if (!app) throw new Error('Application not found');

  app.status = 'submitted';
  app.submittedAt = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(APPLICATIONS_COLLECTION).doc(applicationId).update({
      status: 'submitted',
      submittedAt: app.submittedAt,
    });
  }

  return app;
}

async function reviewApplication(
  applicationId: string,
  payload: {
    status: 'approved' | 'rejected';
    reviewedBy: string;
    rejectionReason?: string | null;
  },
): Promise<InternalApplication> {
  const app = await getApplicationById(applicationId);
  if (!app) throw new Error('Application not found');

  app.status = payload.status;
  app.reviewedAt = new Date().toISOString();
  app.reviewedBy = payload.reviewedBy;
  app.rejectionReason = payload.status === 'rejected' ? payload.rejectionReason ?? null : null;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(APPLICATIONS_COLLECTION).doc(applicationId).update({
      status: app.status,
      reviewedAt: app.reviewedAt,
      reviewedBy: app.reviewedBy,
      rejectionReason: app.rejectionReason,
    });
  }

  return app;
}

async function listDocumentsForCompany(companyId: string): Promise<InternalDocument[]> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(DOCUMENTS_COLLECTION).where('companyId', '==', companyId).get();
    return snapshot.docs.map((doc) => doc.data() as InternalDocument);
  }
  return MEMORY_DB.documents.filter((doc) => doc.companyId === companyId);
}

async function getDocumentById(documentId: string): Promise<InternalDocument | null> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(DOCUMENTS_COLLECTION).doc(documentId).get();
    return snapshot.exists ? (snapshot.data() as InternalDocument) : null;
  }
  return MEMORY_DB.documents.find((doc) => doc.id === documentId) ?? null;
}

async function createDocument(payload: {
  companyId: string;
  name: string;
    category: DocumentCategory;
  fileUrl: string;
  storagePath?: string;
  expiryDate?: string | null;
  fileSize?: number;
  fileHash?: string;
  mimeType?: string;
  pageCount?: number;
  extractedText?: string;
  extractionStatus?: InternalDocument['extractionStatus'];
  extractionError?: string | null;
  aiSummary?: string;
  aiSummaryModel?: string;
  aiSummaryUpdatedAt?: string;
  documentAnalysis?: InternalDocument['documentAnalysis'];
}): Promise<InternalDocument> {
  const docId = createId();
  const document: InternalDocument = {
    id: docId,
    companyId: payload.companyId,
    name: payload.name,
    category: payload.category,
    status: 'uploaded',
    fileUrl: payload.fileUrl,
    storagePath: payload.storagePath,
    expiryDate: payload.expiryDate || null,
    uploadedAt: new Date().toISOString(),
    verifiedAt: null,
    verifiedBy: null,
    fileSize: payload.fileSize,
    fileHash: payload.fileHash,
    mimeType: payload.mimeType,
    pageCount: payload.pageCount,
    extractedText: payload.extractedText,
    extractionStatus: payload.extractionStatus,
    extractionError: payload.extractionError,
    aiSummary: payload.aiSummary,
    aiSummaryModel: payload.aiSummaryModel,
    aiSummaryUpdatedAt: payload.aiSummaryUpdatedAt,
    documentAnalysis: payload.documentAnalysis,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(docId).set(stripUndefined(document));
  } else {
    MEMORY_DB.documents.push(document);
  }

  return document;
}

async function updateDocument(
  documentId: string,
  updates: Partial<Pick<InternalDocument, 
    'name' | 'category' | 'status' | 'expiryDate' | 'verified' | 'fileSize' | 
    'fileHash' | 'mimeType' | 'pageCount' | 'extractedText' | 'extractionStatus' | 'extractionError' | 'is_verified' | 'sarsTcsValidatedAt' | 'aiSummary' | 'aiSummaryModel' | 'aiSummaryUpdatedAt' | 'documentAnalysis'
  >>
): Promise<InternalDocument> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error('Document not found');

  Object.assign(doc, updates);

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(documentId).update(stripUndefined(updates));
  }

  return doc;
}

async function deleteDocument(documentId: string): Promise<void> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(documentId).delete();
  } else {
    const index = MEMORY_DB.documents.findIndex(d => d.id === documentId);
    if (index !== -1) {
      MEMORY_DB.documents.splice(index, 1);
    }
  }
}

async function verifyDocument(documentId: string, verifiedBy: string): Promise<InternalDocument> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error('Document not found');

  doc.status = 'verified';
  doc.verifiedAt = new Date().toISOString();
  doc.verifiedBy = verifiedBy;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(documentId).update({
      status: 'verified',
      verifiedAt: doc.verifiedAt,
      verifiedBy: doc.verifiedBy,
    });
  }

  return doc;
}

async function renewDocument(documentId: string, expiryDate: string | null): Promise<InternalDocument> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error('Document not found');

  doc.expiryDate = expiryDate;
  if (doc.status === 'expired' && expiryDate) {
    doc.status = 'uploaded';
  }

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(documentId).update({
      expiryDate: doc.expiryDate,
      status: doc.status,
    });
  }

  return doc;
}

async function listAllUsers(): Promise<InternalUser[]> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data() as InternalUser);
  }
  return MEMORY_DB.users;
}

async function setUserVerificationStatus(userId: string, status: InternalUser['verificationStatus']): Promise<InternalUser> {
  const user = await getUserDocumentById(userId);
  if (!user) throw new Error('User not found');
  user.verificationStatus = status;

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(USERS_COLLECTION).doc(userId).update({ verificationStatus: status });
  } else {
    await persistLocalAuthUsers();
  }

  return user;
}

async function listAllCompanies(): Promise<Company[]> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const [companySnapshot, userSnapshot] = await Promise.all([
      db.collection(COMPANIES_COLLECTION).get(),
      db.collection(USERS_COLLECTION).get(),
    ]);

    const companyMap = new Map(
      companySnapshot.docs.map((doc) => {
        const company = mapCompanyToPublic(doc.data() as InternalCompany);
        return [company.id, company] as const;
      })
    );

    for (const userDoc of userSnapshot.docs) {
      const fallbackCompany = buildCompanyFromUser(userDoc.data() as InternalUser);
      if (fallbackCompany && !companyMap.has(fallbackCompany.id)) {
        companyMap.set(fallbackCompany.id, fallbackCompany);
      }
    }

    return Array.from(companyMap.values());
  }

  const companyMap = new Map(MEMORY_DB.companies.map((company) => [company.id, mapCompanyToPublic(company)]));
  for (const user of MEMORY_DB.users) {
    const fallbackCompany = buildCompanyFromUser(user);
    if (fallbackCompany && !companyMap.has(fallbackCompany.id)) {
      companyMap.set(fallbackCompany.id, fallbackCompany);
    }
  }

  return Array.from(companyMap.values());
}

async function listAllDocuments(): Promise<InternalDocument[]> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(DOCUMENTS_COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data() as InternalDocument);
  }
  return MEMORY_DB.documents;
}

async function listNotificationsForUser(userId: string, unreadOnly = false, limit = 20): Promise<NotificationRecord[]> {
  const companies = await listCompaniesForUser(userId);
  const companyIds = companies.map((company) => company.id);

  let notifications: NotificationRecord[] = [];

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const directSnapshot = await db.collection(NOTIFICATIONS_COLLECTION).where('userId', '==', userId).get();
    notifications.push(...directSnapshot.docs.map((doc) => doc.data() as NotificationRecord));

    for (let i = 0; i < companyIds.length; i += 30) {
      const chunk = companyIds.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const snapshot = await db.collection(NOTIFICATIONS_COLLECTION).where('companyId', 'in', chunk).get();
      notifications.push(...snapshot.docs.map((doc) => doc.data() as NotificationRecord));
    }
  } else {
    const companySet = new Set(companyIds);
    notifications = MEMORY_DB.notifications.filter((item) => item.userId === userId || companySet.has(item.companyId));
  }

  const seen = new Set<string>();
  return notifications
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return !unreadOnly || !item.isRead;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

async function createNotification(payload: Omit<NotificationRecord, 'id' | 'createdAt' | 'isRead'>): Promise<{ notification: NotificationRecord; created: boolean }> {
  const now = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const existing = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('dedupeKey', '==', payload.dedupeKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { notification: existing.docs[0].data() as NotificationRecord, created: false };
    }

    const notification: NotificationRecord = {
      id: createId(),
      createdAt: now,
      isRead: false,
      delivery: {
        email: 'pending',
        sms: 'pending',
        errors: [],
        attemptedAt: null,
      },
      ...payload,
    };
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id).set(stripUndefined(notification));
    return { notification, created: true };
  }

  const existing = MEMORY_DB.notifications.find((item) => item.dedupeKey === payload.dedupeKey);
  if (existing) return { notification: existing, created: false };

  const notification: NotificationRecord = {
    id: createId(),
    createdAt: now,
    isRead: false,
    delivery: {
      email: 'pending',
      sms: 'pending',
      errors: [],
      attemptedAt: null,
    },
    ...payload,
  };
  MEMORY_DB.notifications.unshift(notification);
  return { notification, created: true };
}

async function createNotificationsForCompany(
  companyId: string,
  payload: Omit<NotificationRecord, 'id' | 'createdAt' | 'isRead' | 'companyId' | 'userId'>,
  options?: { deliver?: boolean },
): Promise<NotificationRecord[]> {
  const members = await listCompanyMembers(companyId);
  const recipients = members.length > 0
    ? members
    : (await listAllUsers()).filter((user) => user.companyId === companyId || user.activeCompanyId === companyId);

  const notifications: NotificationRecord[] = [];
  for (const member of recipients) {
    const { notification, created } = await createNotification({
      ...payload,
      companyId,
      userId: member.id,
      dedupeKey: `${payload.dedupeKey}:user:${member.id}`,
    });

    if (created && options?.deliver !== false) {
      await dispatchNotification(notification, member);
    }

    notifications.push(notification);
  }

  return notifications;
}

async function dispatchNotification(notification: NotificationRecord, recipient: InternalUser): Promise<void> {
  const results = await sendNotificationDeliveries(notification, recipient);
  const email = results.find((result) => result.channel === 'email');
  const sms = results.find((result) => result.channel === 'sms');
  const delivery: NonNullable<NotificationRecord['delivery']> = {
    email: email?.status ?? 'skipped',
    sms: sms?.status ?? 'skipped',
    errors: results
      .filter((result) => result.status === 'failed')
      .map((result) => `${result.channel}:${result.recipient}:${result.reason ?? 'failed'}`),
    attemptedAt: new Date().toISOString(),
  };

  notification.delivery = delivery;
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id).set({ delivery }, { merge: true });
  }
}

async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const notification = await getNotificationForUser(notificationId, userId);
  if (!notification) return false;

  notification.isRead = true;
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).set({ isRead: true }, { merge: true });
  }
  return true;
}

async function markAllNotificationsRead(userId: string): Promise<number> {
  const notifications = await listNotificationsForUser(userId, true, 500);

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const batch = db.batch();
    for (const notification of notifications) {
      notification.isRead = true;
      batch.set(db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id), { isRead: true }, { merge: true });
    }
    await batch.commit();
  } else {
    for (const notification of notifications) {
      notification.isRead = true;
    }
  }

  return notifications.length;
}

async function getNotificationForUser(notificationId: string, userId: string): Promise<NotificationRecord | null> {
  const notifications = await listNotificationsForUser(userId, false, 500);
  return notifications.find((item) => item.id === notificationId) ?? null;
}

async function setDocumentStatus(documentId: string, status: InternalDocument['status'], verifiedBy?: string | null): Promise<InternalDocument> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error('Document not found');

  const now = new Date().toISOString();
  doc.status = status;
  if (status === 'verified') {
    doc.verifiedAt = now;
    doc.verifiedBy = verifiedBy ?? null;
  } else {
    doc.verifiedAt = null;
    doc.verifiedBy = null;
  }

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(documentId).set(
      {
        status: doc.status,
        verifiedAt: doc.verifiedAt,
        verifiedBy: doc.verifiedBy,
      },
      { merge: true }
    );
  }

  return doc;
}

async function createAnalystRun(payload: Omit<AnalystRunRecord, 'id' | 'createdAt'>): Promise<AnalystRunRecord> {
  const run: AnalystRunRecord = {
    id: createId(),
    createdAt: new Date().toISOString(),
    ...payload,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(ANALYST_RUNS_COLLECTION).doc(run.id).set(stripUndefined(run));
  } else {
    MEMORY_DB.analystRuns.unshift(run);
    if (MEMORY_DB.analystRuns.length > 500) {
      MEMORY_DB.analystRuns = MEMORY_DB.analystRuns.slice(0, 500);
    }
  }

  return run;
}

async function listAnalystRunsForCompany(companyId: string, limit = 60): Promise<AnalystRunRecord[]> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db
      .collection(ANALYST_RUNS_COLLECTION)
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as AnalystRunRecord);
  }

  return MEMORY_DB.analystRuns
    .filter((item) => item.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

async function createAnalystEvent(payload: Omit<AnalystEventRecord, 'id' | 'createdAt'>): Promise<AnalystEventRecord> {
  const event: AnalystEventRecord = {
    id: createId(),
    createdAt: new Date().toISOString(),
    ...payload,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(ANALYST_EVENTS_COLLECTION).doc(event.id).set(stripUndefined(event));
  } else {
    MEMORY_DB.analystEvents.unshift(event);
    if (MEMORY_DB.analystEvents.length > 500) {
      MEMORY_DB.analystEvents = MEMORY_DB.analystEvents.slice(0, 500);
    }
  }

  return event;
}

async function upsertTenderMatch(
  payload: Omit<TenderMatchRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TenderMatchRecord> {
  const now = new Date().toISOString();
  const id = `${payload.companyId}_${payload.tenderId}`;
  const match: TenderMatchRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    ...payload,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const ref = db.collection(TENDER_MATCHES_COLLECTION).doc(id);
    const existing = await ref.get();
    await ref.set(
      stripUndefined({
        ...match,
        createdAt: existing.exists ? (existing.data() as TenderMatchRecord).createdAt : now,
      }),
      { merge: true },
    );
    const saved = await ref.get();
    return saved.data() as TenderMatchRecord;
  }

  const index = MEMORY_DB.tenderMatches.findIndex((item) => item.id === id);
  if (index >= 0) {
    match.createdAt = MEMORY_DB.tenderMatches[index].createdAt;
    MEMORY_DB.tenderMatches[index] = match;
  } else {
    MEMORY_DB.tenderMatches.unshift(match);
  }
  return match;
}

async function createScoreHistoryRecord(
  payload: Omit<ScoreHistoryRecord, 'id' | 'createdAt'>
): Promise<ScoreHistoryRecord> {
  const record: ScoreHistoryRecord = {
    id: `${payload.companyId}_${payload.snapshotDate}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SCORE_HISTORY_COLLECTION).doc(record.id).set(stripUndefined(record), { merge: true });
  } else {
    const index = MEMORY_DB.scoreHistory.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      MEMORY_DB.scoreHistory[index] = record;
    } else {
      MEMORY_DB.scoreHistory.unshift(record);
    }
  }

  return record;
}

async function listSavedTenderSearches(userId: string): Promise<SavedTenderSearchRecord[]> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(SAVED_SEARCHES_COLLECTION).where('userId', '==', userId).get();
    return snapshot.docs
      .map((document) => document.data() as SavedTenderSearchRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return MEMORY_DB.savedSearches
    .filter((search) => search.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function createSavedTenderSearch(
  payload: Pick<SavedTenderSearchRecord, 'userId' | 'companyId' | 'name' | 'filters' | 'frequency'>,
): Promise<SavedTenderSearchRecord> {
  const now = new Date().toISOString();
  const record: SavedTenderSearchRecord = {
    id: createId(),
    ...payload,
    enabled: payload.frequency !== 'paused',
    lastDeliveredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SAVED_SEARCHES_COLLECTION).doc(record.id).set(stripUndefined(record));
  } else {
    MEMORY_DB.savedSearches.unshift(record);
  }
  return record;
}

async function deleteSavedTenderSearch(id: string, userId: string): Promise<boolean> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const reference = db.collection(SAVED_SEARCHES_COLLECTION).doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists || (snapshot.data() as SavedTenderSearchRecord).userId !== userId) return false;
    await reference.delete();
    return true;
  }
  const index = MEMORY_DB.savedSearches.findIndex((search) => search.id === id && search.userId === userId);
  if (index < 0) return false;
  MEMORY_DB.savedSearches.splice(index, 1);
  return true;
}

async function markSavedTenderSearchDelivered(id: string, deliveredAt: string): Promise<void> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SAVED_SEARCHES_COLLECTION).doc(id).set({ lastDeliveredAt: deliveredAt, updatedAt: deliveredAt }, { merge: true });
    return;
  }
  const search = MEMORY_DB.savedSearches.find((item) => item.id === id);
  if (search) {
    search.lastDeliveredAt = deliveredAt;
    search.updatedAt = deliveredAt;
  }
}

async function recordScheduledJobRun(result: {
  job: string;
  ok: boolean;
  checkedAt?: string;
  errors?: string[];
  [key: string]: unknown;
}): Promise<ScheduledJobRunRecord> {
  const recordedAt = new Date().toISOString();
  const errors = Array.isArray(result.errors) ? result.errors.map(String).slice(0, 50) : [];
  const metrics: ScheduledJobRunRecord['metrics'] = {};
  for (const [key, value] of Object.entries(result)) {
    if (['job', 'ok', 'checkedAt', 'errors', 'scrapeResults'].includes(key)) continue;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) {
      metrics[key] = value;
    }
  }
  if (Array.isArray(result.scrapeResults)) metrics.sourcesChecked = result.scrapeResults.length;
  const record: ScheduledJobRunRecord = {
    id: `${result.job}_${recordedAt.replace(/[^0-9]/g, '')}_${createId().slice(0, 6)}`,
    job: result.job,
    ok: result.ok,
    status: result.ok ? 'success' : errors.length ? 'failed' : 'partial',
    checkedAt: result.checkedAt || recordedAt,
    recordedAt,
    errors,
    metrics,
  };
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SCHEDULED_JOB_RUNS_COLLECTION).doc(record.id).set(stripUndefined(record));
  } else {
    MEMORY_DB.scheduledJobRuns.unshift(record);
    MEMORY_DB.scheduledJobRuns.splice(100);
  }
  return record;
}

async function listScheduledJobRuns(limit = 20): Promise<ScheduledJobRunRecord[]> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(SCHEDULED_JOB_RUNS_COLLECTION).orderBy('recordedAt', 'desc').limit(limit).get();
    return snapshot.docs.map((document) => document.data() as ScheduledJobRunRecord);
  }
  return [...MEMORY_DB.scheduledJobRuns]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, limit);
}

// In Next.js dev mode each route compiles into its own module scope, so a
// plain `const` resets on every hot-reload.  Pinning to `globalThis` makes
// it a true process-level singleton, so registered users and uploaded
// documents survive hot-reloads without needing a real database.
type _MemDB = {
  users: InternalUser[];
  companies: InternalCompany[];
  tenders: InternalTender[];
  applications: InternalApplication[];
  documents: InternalDocument[];
  analystRuns: AnalystRunRecord[];
  analystEvents: AnalystEventRecord[];
  notifications: NotificationRecord[];
  tenderMatches: TenderMatchRecord[];
  scoreHistory: ScoreHistoryRecord[];
  savedSearches: SavedTenderSearchRecord[];
  scheduledJobRuns: ScheduledJobRunRecord[];
};

declare global {
  var __tenderguard_memory_db: _MemDB | undefined;
}

if (!globalThis.__tenderguard_memory_db) {
  globalThis.__tenderguard_memory_db = {
    users: [...DEFAULT_USERS],
    companies: DEFAULT_COMPANIES,
    tenders: DEFAULT_TENDERS,
    applications: DEFAULT_APPLICATIONS,
    documents: DEFAULT_DOCUMENTS,
    analystRuns: [],
    analystEvents: [],
    notifications: [],
    tenderMatches: [],
    scoreHistory: [],
    savedSearches: [],
    scheduledJobRuns: [],
  };
}

// Additive migrations for an existing dev-mode singleton after hot reloads.
globalThis.__tenderguard_memory_db.savedSearches ??= [];
globalThis.__tenderguard_memory_db.scheduledJobRuns ??= [];

const MEMORY_DB = globalThis.__tenderguard_memory_db;

export {
  getUserDocumentById,
  createUser,
  getOrCreateGoogleUser,
  authenticateUser,
  updateUserName,
  setUserTotpSecret,
  enableUserMfa,
  ensureFirebaseUser,
  listCompaniesForUser,
  listAllCompanies,
  ensureUserCompanyContext,
  getCompanyById,
  setActiveCompany,
  updateCompanyProfile,
  listCompanyMembers,
  createTender,
  listTenders,
  getTenderById,
  getTenderReadiness,
  updateTender,
  deleteTender,
  listApplicationsForCompany,
  listApplicationsForTenders,
  getApplicationById,
  createApplication,
  submitApplication,
  reviewApplication,
  listDocumentsForCompany,
  listAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  verifyDocument,
  renewDocument,
  listAllUsers,
  setUserVerificationStatus,
  setDocumentStatus,
  createAnalystRun,
  listAnalystRunsForCompany,
  createAnalystEvent,
  upsertTenderMatch,
  createScoreHistoryRecord,
  listSavedTenderSearches,
  createSavedTenderSearch,
  deleteSavedTenderSearch,
  markSavedTenderSearchDelivered,
  recordScheduledJobRun,
  listScheduledJobRuns,
  listNotificationsForUser,
  createNotification,
  createNotificationsForCompany,
  markNotificationRead,
  markAllNotificationsRead,
  mapUserToAuthUser,
  mapUserToAuthUserWithOnboarding,
  getUserOnboardingStatus,
};

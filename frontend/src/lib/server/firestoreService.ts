import type { AuthUser, Company, TenderDetail, TenderMatch, TenderReadiness, TenderReadinessScoreBreakdown } from '@/lib/api/types';
import { getFirestore, isFirestoreAvailable, verifyIdToken } from './firebaseAdmin';
import { DEFAULT_COMPANIES, DEFAULT_TENDERS, DEFAULT_USER, DEFAULT_APPLICATIONS, DEFAULT_DOCUMENTS, InternalCompany, InternalTender, InternalUser, InternalApplication, InternalDocument } from './mockData';
import { calculateTenderReadinessScore, type CompanyProfileFields, type DocumentWithAnalysis } from './complianceScoring';
import { getExpiredInPast12Months, isNewAccount } from './expiryCheckService';

// Re-export internal types for use by other services
export type { InternalDocument, InternalCompany, InternalTender, InternalUser };

const USERS_COLLECTION = 'users';
const COMPANIES_COLLECTION = 'companies';
const TENDERS_COLLECTION = 'tenders';
const APPLICATIONS_COLLECTION = 'applications';
const DOCUMENTS_COLLECTION = 'documents';
const ANALYST_RUNS_COLLECTION = 'analyst_runs';
const ANALYST_EVENTS_COLLECTION = 'analyst_events';
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

function mapUserToAuthUser(user: InternalUser): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    verificationStatus: user.verificationStatus,
    onboardingCompleted: true,
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
  const docCategories: Set<string> = new Set(documents.map(d => d.category));
  const missingCategories = requiredCats.filter(cat => !docCategories.has(cat));
  
  // Build checklist based on gaps
  const checklist: Array<{ item: string; status: 'passed' | 'failed' | 'missing' }> = readinessScore.missingForBidReady.map(gap => ({
    item: gap,
    status: 'failed' as const,
  }));
  
  // Add passed items for valid categories
  for (const cat of requiredCats) {
    const doc = documents.find(d => d.category === cat);
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

async function ensureFirestoreSeed() {
  if (!isFirestoreAvailable()) return;
  if (!SHOULD_SEED_FIRESTORE_DEMO_DATA) return;
  const db = getFirestore()!;
  const userSnapshot = await db.collection(USERS_COLLECTION).limit(1).get();
  if (!userSnapshot.empty) return;

  await db.collection(USERS_COLLECTION).doc(DEFAULT_USER.id).set(DEFAULT_USER);
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

  const user = MEMORY_DB.users.find((item) => item.id === userId);
  return user ?? null;
}

async function getUserByToken(token: string): Promise<InternalUser | null> {
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    return getUserDocumentById(decoded.uid);
  } catch {
    return getUserDocumentById(token);
  }
}

async function getUserByEmail(email: string): Promise<InternalUser | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
    return snapshot.empty ? null : (snapshot.docs[0].data() as InternalUser);
  }

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
  const userRole = payload.role === 'admin' ? 'admin' : payload.role === 'tender_provider' ? 'evaluator' : 'user';
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
  }
  return mapUserToAuthUser(user);
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
  return mapCompanyToPublic(company);
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
    isSystem: false,
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
  category: 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration' | 'policy';
  fileUrl: string;
  storagePath?: string;
  expiryDate?: string | null;
  fileSize?: number;
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
    'mimeType' | 'pageCount' | 'extractedText' | 'extractionStatus' | 'extractionError' | 'aiSummary' | 'aiSummaryModel' | 'aiSummaryUpdatedAt' | 'documentAnalysis'
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

const MEMORY_DB = {
  users: [DEFAULT_USER],
  companies: DEFAULT_COMPANIES,
  tenders: DEFAULT_TENDERS,
  applications: DEFAULT_APPLICATIONS,
  documents: DEFAULT_DOCUMENTS,
  analystRuns: [] as AnalystRunRecord[],
  analystEvents: [] as AnalystEventRecord[],
};

export {
  getUserDocumentById,
  getUserByToken,
  getUserByEmail,
  createUser,
  getOrCreateGoogleUser,
  authenticateUser,
  updateUserName,
  ensureFirebaseUser,
  listCompaniesForUser,
  listAllCompanies,
  ensureUserCompanyContext,
  getCompanyById,
  setActiveCompany,
  updateCompanyProfile,
  createTender,
  listTenders,
  getTenderById,
  getTenderReadiness,
  updateTender,
  deleteTender,
  listApplicationsForCompany,
  getApplicationById,
  createApplication,
  submitApplication,
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
  mapUserToAuthUser,
};

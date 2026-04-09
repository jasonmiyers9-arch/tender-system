import type { AuthUser, Company, TenderDetail, TenderMatch, TenderReadiness } from '@/lib/api/types';
import { getFirestore, isFirestoreAvailable, verifyIdToken } from './firebaseAdmin';
import { DEFAULT_COMPANIES, DEFAULT_TENDERS, DEFAULT_USER, DEFAULT_APPLICATIONS, DEFAULT_DOCUMENTS, InternalCompany, InternalTender, InternalUser, InternalApplication, InternalDocument } from './mockData';

const USERS_COLLECTION = 'users';
const COMPANIES_COLLECTION = 'companies';
const TENDERS_COLLECTION = 'tenders';
const APPLICATIONS_COLLECTION = 'applications';
const DOCUMENTS_COLLECTION = 'documents';
const SHOULD_SEED_FIRESTORE_DEMO_DATA = process.env.ENABLE_FIRESTORE_DEMO_SEED === 'true';

function createId() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
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
  companyId?: string;
}): Promise<InternalTender> {
  const tenderId = createId();
  const tender: InternalTender = {
    id: tenderId,
    title: payload.title,
    organization: payload.organization,
    deadline: payload.deadline,
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
    status: 'draft',
    isSystem: false,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(TENDERS_COLLECTION).doc(tenderId).set(tender);
  } else {
    MEMORY_DB.tenders.push(tender);
  }

  return tender;
}

async function listTenders(): Promise<TenderMatch[]> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(TENDERS_COLLECTION).get();
    return snapshot.docs.map((doc) => mapTenderToMatch(doc.data() as InternalTender));
  }
  return MEMORY_DB.tenders.map(mapTenderToMatch);
}

async function getTenderById(tenderId: string): Promise<TenderDetail | null> {
  if (isFirestoreAvailable()) {
    await ensureFirestoreSeed();
    const db = getFirestore()!;
    const snapshot = await db.collection(TENDERS_COLLECTION).doc(tenderId).get();
    return snapshot.exists ? mapTenderToDetail(snapshot.data() as InternalTender) : null;
  }
  const tender = DEFAULT_TENDERS.find((item) => item.id === tenderId);
  return tender ? mapTenderToDetail(tender) : null;
}

async function getTenderReadiness(tenderId: string): Promise<TenderReadiness | null> {
  const tender = DEFAULT_TENDERS.find((item) => item.id === tenderId);
  if (!tender) {
    if (isFirestoreAvailable()) {
      await ensureFirestoreSeed();
      const db = getFirestore()!;
      const snapshot = await db.collection(TENDERS_COLLECTION).doc(tenderId).get();
      if (!snapshot.exists) return null;
      return buildReadiness(snapshot.data() as InternalTender);
    }
    return null;
  }
  return buildReadiness(tender);
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
  category: 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration';
  fileUrl: string;
  expiryDate?: string | null;
}): Promise<InternalDocument> {
  const docId = createId();
  const document: InternalDocument = {
    id: docId,
    companyId: payload.companyId,
    name: payload.name,
    category: payload.category,
    status: 'uploaded',
    fileUrl: payload.fileUrl,
    expiryDate: payload.expiryDate || null,
    uploadedAt: new Date().toISOString(),
    verifiedAt: null,
    verifiedBy: null,
  };

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(DOCUMENTS_COLLECTION).doc(docId).set(document);
  } else {
    MEMORY_DB.documents.push(document);
  }

  return document;
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

const MEMORY_DB = {
  users: [DEFAULT_USER],
  companies: DEFAULT_COMPANIES,
  tenders: DEFAULT_TENDERS,
  applications: DEFAULT_APPLICATIONS,
  documents: DEFAULT_DOCUMENTS,
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
  getCompanyById,
  setActiveCompany,
  updateCompanyProfile,
  createTender,
  listTenders,
  getTenderById,
  getTenderReadiness,
  listApplicationsForCompany,
  getApplicationById,
  createApplication,
  submitApplication,
  listDocumentsForCompany,
  getDocumentById,
  createDocument,
  verifyDocument,
  renewDocument,
  listAllUsers,
  setUserVerificationStatus,
  listAllCompanies,
  listAllDocuments,
  setDocumentStatus,
  mapUserToAuthUser,
};

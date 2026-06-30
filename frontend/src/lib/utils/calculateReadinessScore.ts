import { DOCUMENT_CATEGORY_GROUPS, type DocumentCategory } from '@/lib/api/types';

// Calculates the Tender Readiness Score from a company's compliance documents.
// Each of the 6 required categories contributes 100/6 ≈ 16.67%.
// Valid doc (exists + not expired, OR has no expiry date) → full weight
// Expired doc (past its expiry date or marked expired) → half weight
// Missing doc → 0
//
// A document without an expiry date is treated as permanently valid — many
// compliance documents (registration certificates, policies, legal records) do
// not expire, so requiring an expiry date here previously kept the score and the
// "documents complete" count stuck at 0.

const REQUIRED_CATEGORIES = [
  'tax',
  'legal',
  'financial',
  'bbbee',
  'certification',
  'registration',
] as const;


interface ScoredDocument {
  category: string;
  expiryDate?: string | null;
  status?: string;
}

function documentGroup(category: string): string {
  return DOCUMENT_CATEGORY_GROUPS[category as DocumentCategory] ?? category;
}

// A document is "expired" only when it has an expiry date in the past, or its
// status was explicitly set to expired. A document with no expiry date never
// expires and counts as fully valid.
function isExpiredDocument(doc: ScoredDocument, now: Date): boolean {
  if (doc.status === 'expired') return true;
  if (!doc.expiryDate) return false;
  return new Date(doc.expiryDate) < now;
}

export function calculateReadinessScore(documents: ScoredDocument[]): number {
  const weight = 100 / REQUIRED_CATEGORIES.length;
  const now = new Date();
  let score = 0;

  for (const category of REQUIRED_CATEGORIES) {
    const doc = documents.find((d) => documentGroup(d.category) === category);

    if (doc) {
      score += isExpiredDocument(doc, now) ? weight * 0.5 : weight;
    }
  }

  return Math.round(score);
}

export function buildComplianceScore(documents: ScoredDocument[]) {
  const now = new Date();
  const score = calculateReadinessScore(documents);

  const presentCategories = new Set(documents.map((d) => documentGroup(d.category)));
  const missingDocuments = REQUIRED_CATEGORIES.filter(
    (c) => !presentCategories.has(c)
  );

  const expiringDocuments = documents
    .filter((d) => {
      if (!d.expiryDate) return false;
      const exp = new Date(d.expiryDate);
      const daysUntilExpiry = (exp.getTime() - now.getTime()) / 86_400_000;
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    })
    .map((d) => (d as { name?: string; category: string }).name ?? d.category);

  const completedDocuments = REQUIRED_CATEGORIES.filter((c) => {
    const doc = documents.find((d) => documentGroup(d.category) === c);
    return doc && !isExpiredDocument(doc, now);
  }).length;

  const band: 'tender-ready' | 'partially-ready' | 'high-risk' =
    score >= 85 ? 'tender-ready' : score >= 65 ? 'partially-ready' : 'high-risk';

  return {
    score,
    band,
    completedDocuments,
    totalDocuments: REQUIRED_CATEGORIES.length,
    missingDocuments,
    expiringDocuments,
    lastCalculated: new Date().toISOString(),
  };
}

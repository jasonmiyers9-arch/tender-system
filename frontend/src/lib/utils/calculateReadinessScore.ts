// Calculates the Tender Readiness Score from a company's compliance documents.
// Each of the 6 required categories contributes 100/6 ≈ 16.67%.
// Valid doc (exists + not expired) → full weight
// Expired doc (exists but expired) → half weight
// Missing doc → 0

const REQUIRED_CATEGORIES = [
  'tax',
  'legal',
  'financial',
  'bbbee',
  'certification',
  'registration',
] as const;

type RequiredCategory = (typeof REQUIRED_CATEGORIES)[number];

interface ScoredDocument {
  category: string;
  expiryDate?: string | null;
  status?: string;
}

export function calculateReadinessScore(documents: ScoredDocument[]): number {
  const weight = 100 / REQUIRED_CATEGORIES.length;
  let score = 0;

  for (const category of REQUIRED_CATEGORIES) {
    const doc = documents.find((d) => d.category === category);

    if (doc) {
      const isValid =
        !!doc.expiryDate && new Date(doc.expiryDate) > new Date();

      score += isValid ? weight : weight * 0.5;
    }
  }

  return Math.round(score);
}

export function buildComplianceScore(documents: ScoredDocument[]) {
  const now = new Date();
  const score = calculateReadinessScore(documents);

  const presentCategories = new Set(documents.map((d) => d.category));
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
    const doc = documents.find((d) => d.category === c);
    return doc && doc.expiryDate && new Date(doc.expiryDate) > now;
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

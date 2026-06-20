const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';

const COMPANY_LOGIN = {
  email: process.env.SEED_COMPANY_EMAIL || 'demo@tenderguard.local',
  password: process.env.SEED_COMPANY_PASSWORD || 'password',
};

const ADMIN_LOGIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'mouse@tenderguard.dev',
  password: process.env.SEED_ADMIN_PASSWORD || 'Demo@1234',
};

const CATEGORIES = [
  'tax_clearance',
  'sars_pin',
  'vat_certificate',
  'cipc_registration',
  'company_profile',
  'csd_supplier_summary',
  'director_ids',
  'shareholder_register',
  'bbbee_certificate',
  'bbbee_affidavit',
  'cidb_certificate',
  'nhbrc_certificate',
  'letter_good_standing',
  'coida_certificate',
  'public_liability_insurance',
  'professional_indemnity',
  'financial_statements',
  'bank_statement',
  'bank_confirmation',
  'municipal_account',
  'proof_of_address',
  'lease_agreement',
  'health_safety_plan',
  'quality_management_policy',
  'environmental_policy',
  'iso_certificate',
  'poa_authority',
  'joint_venture_agreement',
  'other_compliance',
];

async function request(pathname, init = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, init);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (response.status === 429) {
    const retryAfter = Number(json?.retryAfter ?? response.headers.get('retry-after') ?? 60);
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000));
    return request(pathname, init);
  }
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${pathname} failed (${response.status}): ${text}`);
  }
  return json;
}

async function login(credentials, admin = false) {
  const json = await request(admin ? '/api/auth/admin/login' : '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return json.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function documentBody(category) {
  return [
    'Tender Guard Pro dummy compliance document',
    `Category: ${category}`,
    'Company: Demo Compliance Holdings',
    'Registration: 2024/123456/07',
    'CSD: MAAA0000000',
    'B-BBEE: Level 2',
    'CIDB: 5GB',
    'Issued: 2026-06-10',
    'Expiry: 2027-06-10',
    'Purpose: local test data for tender match recommendations',
  ].join('\n');
}

async function uploadDocument(token, category) {
  const filename = `${category}.txt`;

  const form = new FormData();
  form.append('category', category);
  form.append('run_ai', 'false');
  form.append('file', new Blob([documentBody(category)], { type: 'text/plain' }), filename);

  return request('/api/documents/upload', {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
}

async function main() {
  const companyToken = await login(COMPANY_LOGIN);
  const adminToken = await login(ADMIN_LOGIN, true);

  await request('/api/companies/active', {
    method: 'PATCH',
    headers: { ...authHeaders(companyToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'it',
      province: 'Gauteng',
      csdNumber: 'MAAA0000000',
      bbbeeLevel: '2',
      cidbGrade: '5GB',
      tenderCategories: ['IT & Technology'],
    }),
  });

  const existing = await request('/api/documents', {
    headers: authHeaders(companyToken),
  });
  const existingCategories = new Set(existing.map((doc) => doc.category));

  const uploaded = [];
  for (const category of CATEGORIES) {
    if (existingCategories.has(category)) continue;
    const document = await uploadDocument(companyToken, category);
    uploaded.push(document);
  }

  const allDocuments = await request('/api/documents', {
    headers: authHeaders(companyToken),
  });

  const expiryDate = '2027-06-10';
  let verified = 0;
  for (const document of allDocuments) {
    await request(`/api/documents/${document.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(companyToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryDate }),
    });
    if (document.status !== 'verified') {
      await request(`/api/admin/documents/${document.id}/verify`, {
        method: 'POST',
        headers: authHeaders(adminToken),
      });
      verified += 1;
    }
  }

  const matches = await request('/api/tenders', {
    headers: authHeaders(companyToken),
  });

  console.log(JSON.stringify({
    ok: true,
    company: COMPANY_LOGIN.email,
    category: 'IT & Technology',
    uploaded: uploaded.length,
    totalDocuments: allDocuments.length,
    verified,
    tenderMatches: matches.length,
    topMatches: matches.slice(0, 5).map((match) => ({
      title: match.title,
      category: match.category,
      readinessScore: match.readinessScore ?? match.matchScore,
      isBidReady: match.isBidReady,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

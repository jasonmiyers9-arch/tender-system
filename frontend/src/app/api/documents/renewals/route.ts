import { NextResponse } from 'next/server';
import { getUserByToken, listDocumentsForCompany, listTenders, getTenderReadiness } from '@/lib/server/firestoreService';
import { getExpiringDocuments, type ExpiredDocumentInfo } from '@/lib/server/expiryCheckService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export interface RenewalItem extends ExpiredDocumentInfo {
  urgency: 'expired' | 'critical' | 'warning' | 'upcoming';
  daysRemaining: number;
  affectedTenders: Array<{
    tenderId: string;
    title: string;
    deadline: string;
    requiredCategory: string;
  }>;
}

export interface RenewalsResponse {
  companyId: string;
  summary: {
    expired: number;
    critical: number;    // 1-7 days
    warning: number;     // 8-30 days
    upcoming: number;    // 31-90 days
    totalAffectedTenders: number;
  };
  renewals: RenewalItem[];
  lastChecked: string;
}

function getUrgency(daysOverdue: number): 'expired' | 'critical' | 'warning' | 'upcoming' {
  // daysOverdue is positive for expired, negative for days remaining
  if (daysOverdue > 0) return 'expired';
  const daysRemaining = Math.abs(daysOverdue);
  if (daysRemaining <= 7) return 'critical';
  if (daysRemaining <= 30) return 'warning';
  return 'upcoming';
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || !user.activeCompanyId) {
    return NextResponse.json({ detail: 'No company context' }, { status: 400 });
  }

  const companyId = user.activeCompanyId;

  try {
    // Get expiring documents (includes expired)
    const expiringDocs = await getExpiringDocuments(companyId, 90);
    
    // Get all tenders to check impact
    const tenders = await listTenders();
    
    // Build renewal items with tender impact
    const renewals: RenewalItem[] = await Promise.all(
      expiringDocs.map(async (doc) => {
        const urgency = getUrgency(doc.daysOverdue);
        const daysRemaining = doc.daysOverdue <= 0 ? Math.abs(doc.daysOverdue) : 0;
        
        // Find tenders that require this document category
        const affectedTenders: RenewalItem['affectedTenders'] = [];
        
        for (const tender of tenders) {
          const requiredCats = tender.required_categories ?? tender.recommendedDocuments ?? [];
          if (requiredCats.includes(doc.category)) {
            affectedTenders.push({
              tenderId: tender.id,
              title: tender.title,
              deadline: tender.deadline,
              requiredCategory: doc.category,
            });
          }
        }
        
        return {
          ...doc,
          urgency,
          daysRemaining,
          affectedTenders,
        };
      })
    );

    // Calculate summary
    const summary = {
      expired: renewals.filter(r => r.urgency === 'expired').length,
      critical: renewals.filter(r => r.urgency === 'critical').length,
      warning: renewals.filter(r => r.urgency === 'warning').length,
      upcoming: renewals.filter(r => r.urgency === 'upcoming').length,
      totalAffectedTenders: new Set(renewals.flatMap(r => r.affectedTenders.map(t => t.tenderId))).size,
    };

    const response: RenewalsResponse = {
      companyId,
      summary,
      renewals,
      lastChecked: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('GET /api/documents/renewals error:', error);
    return NextResponse.json({ detail: 'Failed to fetch renewals' }, { status: 500 });
  }
}

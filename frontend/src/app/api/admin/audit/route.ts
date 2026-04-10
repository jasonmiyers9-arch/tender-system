import { NextResponse } from 'next/server';
import type { AuditEntry } from '@/lib/api/types';
import { requireAdmin } from '@/lib/server/apiAuth';
import { listAllCompanies, listAllDocuments, listAllUsers } from '@/lib/server/firestoreService';

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toTimestamp(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get('page_size'), 20), 100);
  const actorFilter = url.searchParams.get('actor')?.trim().toLowerCase() ?? '';
  const actionFilter = url.searchParams.get('action')?.trim().toLowerCase() ?? '';

  const [users, companies, documents] = await Promise.all([
    listAllUsers(),
    listAllCompanies(),
    listAllDocuments(),
  ]);

  const companyNames = new Map(companies.map((company) => [company.id, company.name]));
  const userNames = new Map(users.map((user) => [user.id, user.fullName]));

  const entries: AuditEntry[] = [
    ...users.map((user) => ({
      id: `user-created-${user.id}`,
      actor: user.fullName || user.email,
      action: `Account ${user.verificationStatus}`,
      entity: 'user',
      entityId: user.id,
      timestamp: user.createdAt,
      metadata: {
        email: user.email,
        role: user.role,
        verificationStatus: user.verificationStatus,
      },
    })),
    ...documents.flatMap((document) => {
      const companyName = companyNames.get(document.companyId) ?? document.companyId;
      const uploadedEntry: AuditEntry = {
        id: `document-uploaded-${document.id}`,
        actor: companyName,
        action: 'Document uploaded',
        entity: document.category,
        entityId: document.id,
        timestamp: document.uploadedAt,
        metadata: {
          companyId: document.companyId,
          companyName,
          documentName: document.name,
          status: document.status,
        },
      };

      const verifiedEntry = document.verifiedAt
        ? {
            id: `document-reviewed-${document.id}`,
            actor: userNames.get(document.verifiedBy ?? '') ?? document.verifiedBy ?? 'System',
            action: document.status === 'rejected' ? 'Document rejected' : 'Document verified',
            entity: document.category,
            entityId: document.id,
            timestamp: document.verifiedAt,
            metadata: {
              companyId: document.companyId,
              companyName,
              documentName: document.name,
              status: document.status,
            },
          }
        : null;

      return verifiedEntry ? [uploadedEntry, verifiedEntry] : [uploadedEntry];
    }),
  ]
    .filter((entry) => {
      if (actorFilter && !entry.actor.toLowerCase().includes(actorFilter)) return false;
      if (actionFilter && !entry.action.toLowerCase().includes(actionFilter)) return false;
      return true;
    })
    .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp));

  const start = (page - 1) * pageSize;
  const paged = entries.slice(start, start + pageSize);

  return NextResponse.json({
    entries: paged,
    total: entries.length,
  });
}
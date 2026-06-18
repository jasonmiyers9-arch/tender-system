import {
  getApplicationById,
  getTenderById,
  getUserDocumentById,
  type InternalApplication,
} from './firestoreService';
import { isAdminRole } from './apiAuth';

export async function canReviewApplication(
  applicationId: string,
  userId: string,
  role: string,
): Promise<{ ok: true; application: InternalApplication } | { ok: false; status: number; detail: string }> {
  const application = await getApplicationById(applicationId);
  if (!application) {
    return { ok: false, status: 404, detail: 'Application not found' };
  }

  if (isAdminRole(role)) {
    return { ok: true, application };
  }

  if (role !== 'evaluator') {
    return { ok: false, status: 403, detail: 'Forbidden' };
  }

  const tender = await getTenderById(application.tenderId);
  if (!tender?.createdBy || tender.createdBy !== userId) {
    return { ok: false, status: 404, detail: 'Application not found' };
  }

  return { ok: true, application };
}

export async function reviewerName(userId: string): Promise<string> {
  const user = await getUserDocumentById(userId);
  return user?.fullName ?? userId;
}

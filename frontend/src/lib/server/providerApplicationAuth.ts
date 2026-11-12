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

  const tender = await getTenderById(application.tenderId);
  if (role === 'evaluator' && tender?.createdBy === userId) {
    return { ok: true, application };
  }

  return { ok: false, status: 403, detail: 'Only the tender owner or an admin can review this application' };
}

export async function reviewerName(userId: string): Promise<string> {
  const user = await getUserDocumentById(userId);
  return user?.fullName ?? userId;
}

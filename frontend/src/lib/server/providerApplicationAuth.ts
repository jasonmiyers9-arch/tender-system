import {
  getApplicationById,
  getUserDocumentById,
  type InternalApplication,
} from './firestoreService';
import { isAdminRole } from './apiAuth';

export async function canReviewApplication(
  applicationId: string,
  _userId: string,
  role: string,
): Promise<{ ok: true; application: InternalApplication } | { ok: false; status: number; detail: string }> {
  const application = await getApplicationById(applicationId);
  if (!application) {
    return { ok: false, status: 404, detail: 'Application not found' };
  }

  if (!isAdminRole(role)) {
    return { ok: false, status: 403, detail: 'Admin only' };
  }

  return { ok: true, application };
}

export async function reviewerName(userId: string): Promise<string> {
  const user = await getUserDocumentById(userId);
  return user?.fullName ?? userId;
}

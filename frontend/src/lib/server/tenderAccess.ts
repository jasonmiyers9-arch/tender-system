export function isPublishedTender(status: string | null | undefined): boolean {
  return !status || status === 'published';
}

export function viewerCanSeeUnpublished(
  role: string | null | undefined,
  createdBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!role || !userId) return false;
  if (role === 'admin' || role === 'super_admin') return true;
  return role === 'evaluator' && Boolean(createdBy) && createdBy === userId;
}

export function redactTender<T extends { contact?: unknown; createdBy?: string; rejectionReason?: string | null }>(
  tender: T,
  authenticated: boolean,
): T {
  if (authenticated) return tender;
  const copy = { ...tender };
  delete copy.contact;
  delete copy.createdBy;
  delete copy.rejectionReason;
  return copy;
}

export function enqueueDocumentAiProcessing(documentId: string, storageKey: string, companyId: string): void {
  const enabled = process.env.DOCUMENT_AI_ENABLED === 'true' || process.env.DOCUMENT_AI_ENABLED === '1';
  if (!enabled) {
    console.info('Document AI pipeline disabled; skipping analysis.', { documentId, companyId, storageKey });
    return;
  }

  console.info('Document AI pipeline scheduled for document.', {
    documentId,
    companyId,
    storageKey,
  });
  // TODO: connect this hook to a queue, worker, or external AI service.
}

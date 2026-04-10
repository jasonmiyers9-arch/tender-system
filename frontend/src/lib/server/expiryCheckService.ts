/**
 * Document Expiry Check Service
 * 
 * Scans all documents for expiry status and triggers rescore events
 * when documents expire. Per Section 4.4: "Day after expiry, Tender Match 
 * engine re-runs. Any tenders requiring that document are flagged as 'incomplete'."
 * 
 * This service should be invoked:
 * - Via a daily cron/scheduled job
 * - On application startup
 * - Manually via admin API for immediate check
 */

import {
  listAllDocuments,
  listDocumentsForCompany,
  updateDocument,
  type InternalDocument,
} from './firestoreService';
import { publishRescoreEvent } from './analystEngine';

export interface ExpiryCheckResult {
  checkedAt: string;
  documentsChecked: number;
  newlyExpired: ExpiredDocumentInfo[];
  expiringSoon: ExpiredDocumentInfo[];
  rescoreEventsTriggered: number;
  errors: string[];
}

export interface ExpiredDocumentInfo {
  documentId: string;
  documentName: string;
  category: string;
  companyId: string;
  expiryDate: string;
  daysOverdue: number;
}

/**
 * Calculate days until expiry (negative if already expired)
 */
function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check all documents for expiry and trigger rescore events
 * 
 * @param dryRun - If true, only report what would happen without making changes
 * @returns ExpiryCheckResult with summary of actions taken
 */
export async function runExpiryCheck(dryRun = false): Promise<ExpiryCheckResult> {
  const result: ExpiryCheckResult = {
    checkedAt: new Date().toISOString(),
    documentsChecked: 0,
    newlyExpired: [],
    expiringSoon: [],
    rescoreEventsTriggered: 0,
    errors: [],
  };

  try {
    const documents = await listAllDocuments();
    result.documentsChecked = documents.length;

    // Track companies that need rescore
    const companiesToRescore = new Set<string>();

    for (const doc of documents) {
      if (!doc.expiryDate) continue;

      const days = daysUntilExpiry(doc.expiryDate);
      if (days === null) continue;

      // Document has expired
      if (days < 0) {
        const expiredInfo: ExpiredDocumentInfo = {
          documentId: doc.id,
          documentName: doc.name,
          category: doc.category,
          companyId: doc.companyId,
          expiryDate: doc.expiryDate,
          daysOverdue: Math.abs(days),
        };

        // Only process if not already marked as expired
        if (doc.status !== 'expired') {
          result.newlyExpired.push(expiredInfo);
          companiesToRescore.add(doc.companyId);

          if (!dryRun) {
            try {
              // Update document status to expired
              await updateDocument(doc.id, { status: 'expired' as InternalDocument['status'] });
            } catch (err) {
              result.errors.push(`Failed to update document ${doc.id}: ${err}`);
            }
          }
        }
      }
      // Document expiring within 30 days
      else if (days <= 30) {
        result.expiringSoon.push({
          documentId: doc.id,
          documentName: doc.name,
          category: doc.category,
          companyId: doc.companyId,
          expiryDate: doc.expiryDate,
          daysOverdue: -days, // Negative to indicate days remaining
        });
      }
    }

    // Trigger rescore events for affected companies
    if (!dryRun) {
      for (const companyId of companiesToRescore) {
        try {
          await publishRescoreEvent({
            eventType: 'document.expired',
            companyId,
            metadata: {
              triggeredBy: 'expiry-check-service',
              expiredDocumentCount: result.newlyExpired.filter(d => d.companyId === companyId).length,
            },
          });
          result.rescoreEventsTriggered++;
        } catch (err) {
          result.errors.push(`Failed to trigger rescore for company ${companyId}: ${err}`);
        }
      }
    }

  } catch (err) {
    result.errors.push(`Expiry check failed: ${err}`);
  }

  return result;
}

/**
 * Get count of documents that expired in the past 12 months for a company
 * Used for Compliance Consistency scoring dimension (15pts)
 */
export async function getExpiredInPast12Months(companyId: string): Promise<number> {
  const documents = await listAllDocuments();
  const companyDocs = documents.filter(d => d.companyId === companyId);
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  let expiredCount = 0;
  for (const doc of companyDocs) {
    if (!doc.expiryDate) continue;
    
    const expiryDate = new Date(doc.expiryDate);
    const today = new Date();
    
    // Document expired within the past 12 months
    if (expiryDate < today && expiryDate >= twelveMonthsAgo) {
      expiredCount++;
    }
  }
  
  return expiredCount;
}

/**
 * Get documents expiring within specified days for a company
 * Used for renewal workflow listing
 */
export async function getExpiringDocuments(
  companyId: string,
  withinDays = 90
): Promise<ExpiredDocumentInfo[]> {
  const documents = await listAllDocuments();
  const companyDocs = documents.filter(d => d.companyId === companyId);
  
  const expiring: ExpiredDocumentInfo[] = [];
  
  for (const doc of companyDocs) {
    if (!doc.expiryDate) continue;
    
    const days = daysUntilExpiry(doc.expiryDate);
    if (days === null) continue;
    
    // Include expired docs (negative days) and docs expiring within window
    if (days <= withinDays) {
      expiring.push({
        documentId: doc.id,
        documentName: doc.name,
        category: doc.category,
        companyId: doc.companyId,
        expiryDate: doc.expiryDate,
        daysOverdue: days < 0 ? Math.abs(days) : -days,
      });
    }
  }
  
  // Sort by days overdue (expired first, then soonest to expire)
  expiring.sort((a, b) => b.daysOverdue - a.daysOverdue);
  
  return expiring;
}

/**
 * Check if a company account is new (created within past 12 months)
 * Used for Compliance Consistency scoring (new accounts start at 10pts)
 * Since Company type doesn't have createdAt, we use earliest document uploadedAt as proxy
 */
export async function isNewAccount(companyId: string): Promise<boolean> {
  const documents = await listDocumentsForCompany(companyId);
  
  if (documents.length === 0) {
    return true; // No documents = assume new account
  }
  
  // Find earliest document upload date as proxy for account creation
  const uploadDates = documents
    .map(d => d.uploadedAt ? new Date(d.uploadedAt) : null)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
  
  if (uploadDates.length === 0) {
    return true; // No valid dates = assume new
  }
  
  const earliestUpload = new Date(Math.min(...uploadDates.map(d => d.getTime())));
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  return earliestUpload >= twelveMonthsAgo;
}

/**
 * Security Audit Logging Service
 * 
 * Provides structured logging for security-relevant events including
 * authentication, authorization, data access, and suspicious activity.
 * 
 * Logs are structured for easy ingestion into SIEM systems.
 */

import { getFirestore, isFirestoreAvailable, requireFirestore } from './firebaseAdmin';

/**
 * Security event types for categorization
 */
export enum SecurityEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token.refresh',
  AUTH_TOKEN_INVALID = 'auth.token.invalid',
  AUTH_SESSION_EXPIRED = 'auth.session.expired',
  AUTH_PASSWORD_RESET_REQUEST = 'auth.password.reset_request',
  AUTH_PASSWORD_RESET_SUCCESS = 'auth.password.reset_success',
  AUTH_REGISTER = 'auth.register',
  AUTH_EMAIL_VERIFIED = 'auth.email.verified',
  
  // Authorization events
  AUTHZ_ACCESS_DENIED = 'authz.access.denied',
  AUTHZ_ROLE_INSUFFICIENT = 'authz.role.insufficient',
  AUTHZ_COMPANY_MISMATCH = 'authz.company.mismatch',
  AUTHZ_ADMIN_ACTION = 'authz.admin.action',
  
  // Data access events
  DATA_ACCESS = 'data.access',
  DATA_CREATE = 'data.create',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  DATA_BULK_OPERATION = 'data.bulk_operation',
  
  // File operations
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',
  FILE_DELETE = 'file.delete',
  FILE_VALIDATION_FAILURE = 'file.validation.failure',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',
  RATE_LIMIT_WARNING = 'rate_limit.warning',
  
  // Suspicious activity
  SUSPICIOUS_REQUEST = 'suspicious.request',
  SUSPICIOUS_PAYLOAD = 'suspicious.payload',
  SUSPICIOUS_PATTERN = 'suspicious.pattern',
  
  // System events
  SYSTEM_CONFIG_CHANGE = 'system.config.change',
  SYSTEM_API_KEY_ROTATED = 'system.api_key.rotated',
  SYSTEM_ERROR = 'system.error',
}

/**
 * Severity levels for security events
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security event structure
 */
export interface SecurityEvent {
  /** Unique event ID */
  id?: string;
  /** Event type */
  type: SecurityEventType;
  /** Severity level */
  severity: SecurityEventSeverity;
  /** ISO timestamp */
  timestamp: string;
  /** User ID (if authenticated) */
  userId?: string | null;
  /** User email (if available) */
  userEmail?: string | null;
  /** User role */
  userRole?: string | null;
  /** Company ID (if in company context) */
  companyId?: string | null;
  /** Client IP address */
  ipAddress?: string | null;
  /** User agent string */
  userAgent?: string | null;
  /** HTTP method */
  method?: string | null;
  /** Request path */
  path?: string | null;
  /** Event-specific details */
  details?: Record<string, unknown>;
  /** Resource type (e.g., 'document', 'tender') */
  resourceType?: string | null;
  /** Resource ID */
  resourceId?: string | null;
  /** Action outcome */
  outcome: 'success' | 'failure' | 'blocked' | 'warning';
  /** Error message if applicable */
  errorMessage?: string | null;
  /** Session ID for correlation */
  sessionId?: string | null;
  /** Request ID for tracing */
  requestId?: string | null;
}

// In-memory buffer for batch writes
const eventBuffer: SecurityEvent[] = [];
const BUFFER_FLUSH_SIZE = 10;
const BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds
let flushTimer: NodeJS.Timeout | null = null;

// Local fallback log file
const localLogs: SecurityEvent[] = [];
const MAX_LOCAL_LOGS = 1000;

/**
 * Extract client information from request
 */
export function extractRequestContext(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
  path: string;
} {
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress = forwarded 
    ? forwarded.split(',')[0].trim()
    : req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null;
  
  const url = new URL(req.url);
  
  return {
    ipAddress,
    userAgent: req.headers.get('user-agent'),
    method: req.method,
    path: url.pathname,
  };
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine severity based on event type
 */
function getDefaultSeverity(type: SecurityEventType): SecurityEventSeverity {
  const severityMap: Record<SecurityEventType, SecurityEventSeverity> = {
    // Info level
    [SecurityEventType.AUTH_LOGIN_SUCCESS]: SecurityEventSeverity.INFO,
    [SecurityEventType.AUTH_LOGOUT]: SecurityEventSeverity.INFO,
    [SecurityEventType.AUTH_TOKEN_REFRESH]: SecurityEventSeverity.INFO,
    [SecurityEventType.AUTH_REGISTER]: SecurityEventSeverity.INFO,
    [SecurityEventType.AUTH_EMAIL_VERIFIED]: SecurityEventSeverity.INFO,
    [SecurityEventType.DATA_ACCESS]: SecurityEventSeverity.INFO,
    [SecurityEventType.FILE_DOWNLOAD]: SecurityEventSeverity.INFO,
    
    // Low level
    [SecurityEventType.DATA_CREATE]: SecurityEventSeverity.LOW,
    [SecurityEventType.DATA_UPDATE]: SecurityEventSeverity.LOW,
    [SecurityEventType.FILE_UPLOAD]: SecurityEventSeverity.LOW,
    [SecurityEventType.AUTH_PASSWORD_RESET_REQUEST]: SecurityEventSeverity.LOW,
    [SecurityEventType.AUTH_PASSWORD_RESET_SUCCESS]: SecurityEventSeverity.LOW,
    [SecurityEventType.AUTH_SESSION_EXPIRED]: SecurityEventSeverity.LOW,
    [SecurityEventType.RATE_LIMIT_WARNING]: SecurityEventSeverity.LOW,
    
    // Medium level
    [SecurityEventType.AUTH_LOGIN_FAILURE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.AUTH_TOKEN_INVALID]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.AUTHZ_ACCESS_DENIED]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.AUTHZ_ROLE_INSUFFICIENT]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.DATA_DELETE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.DATA_EXPORT]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.FILE_DELETE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.FILE_VALIDATION_FAILURE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.SYSTEM_CONFIG_CHANGE]: SecurityEventSeverity.MEDIUM,
    
    // High level
    [SecurityEventType.AUTHZ_COMPANY_MISMATCH]: SecurityEventSeverity.HIGH,
    [SecurityEventType.AUTHZ_ADMIN_ACTION]: SecurityEventSeverity.HIGH,
    [SecurityEventType.DATA_BULK_OPERATION]: SecurityEventSeverity.HIGH,
    [SecurityEventType.SUSPICIOUS_REQUEST]: SecurityEventSeverity.HIGH,
    [SecurityEventType.SUSPICIOUS_PAYLOAD]: SecurityEventSeverity.HIGH,
    [SecurityEventType.SYSTEM_API_KEY_ROTATED]: SecurityEventSeverity.HIGH,
    
    // Critical level
    [SecurityEventType.SUSPICIOUS_PATTERN]: SecurityEventSeverity.CRITICAL,
    [SecurityEventType.SYSTEM_ERROR]: SecurityEventSeverity.CRITICAL,
  };
  
  return severityMap[type] || SecurityEventSeverity.INFO;
}

/**
 * Flush buffered events to Firestore
 */
async function flushEventBuffer(): Promise<void> {
  if (eventBuffer.length === 0) return;
  
  const eventsToFlush = eventBuffer.splice(0, eventBuffer.length);
  
  if (!isFirestoreAvailable()) {
    // Store locally if Firestore unavailable
    for (const event of eventsToFlush) {
      localLogs.push(event);
      if (localLogs.length > MAX_LOCAL_LOGS) {
        localLogs.shift();
      }
    }
    console.log(`[SecurityAudit] Stored ${eventsToFlush.length} events locally (Firestore unavailable)`);
    return;
  }
  
  try {
    const firestore = requireFirestore();
    const batch = firestore.batch();
    const collection = firestore.collection('security_audit_logs');
    
    for (const event of eventsToFlush) {
      const docRef = collection.doc();
      batch.set(docRef, {
        ...event,
        id: docRef.id,
      });
    }
    
    await batch.commit();
    console.log(`[SecurityAudit] Flushed ${eventsToFlush.length} events to Firestore`);
  } catch (error) {
    // On error, store locally as fallback
    for (const event of eventsToFlush) {
      localLogs.push(event);
      if (localLogs.length > MAX_LOCAL_LOGS) {
        localLogs.shift();
      }
    }
    console.error('[SecurityAudit] Failed to flush events to Firestore:', error);
  }
}

/**
 * Start the flush timer if not already running
 */
function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flushEventBuffer, BUFFER_FLUSH_INTERVAL);
  if (flushTimer.unref) flushTimer.unref();
}

/**
 * Log a security event
 */
export async function logSecurityEvent(
  event: Omit<SecurityEvent, 'id' | 'timestamp' | 'severity'> & { severity?: SecurityEventSeverity }
): Promise<void> {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    severity: event.severity || getDefaultSeverity(event.type),
  };
  
  // Always log to console for server logs
  const logLevel = fullEvent.severity === SecurityEventSeverity.CRITICAL 
    || fullEvent.severity === SecurityEventSeverity.HIGH
    ? 'error' 
    : fullEvent.severity === SecurityEventSeverity.MEDIUM 
      ? 'warn' 
      : 'info';
  
  console[logLevel](`[SecurityAudit] ${fullEvent.type}`, {
    severity: fullEvent.severity,
    userId: fullEvent.userId,
    outcome: fullEvent.outcome,
    path: fullEvent.path,
    details: fullEvent.details,
  });
  
  // Add to buffer
  eventBuffer.push(fullEvent);
  ensureFlushTimer();
  
  // Flush immediately for high-severity events
  if (fullEvent.severity === SecurityEventSeverity.HIGH 
      || fullEvent.severity === SecurityEventSeverity.CRITICAL
      || eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushEventBuffer();
  }
}

// ============================================================================
// Convenience logging functions for common events
// ============================================================================

/**
 * Log successful authentication
 */
export async function logAuthSuccess(
  req: Request,
  userId: string,
  userEmail: string,
  method: 'password' | 'google' | 'token_refresh' = 'password'
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: method === 'token_refresh' 
      ? SecurityEventType.AUTH_TOKEN_REFRESH 
      : SecurityEventType.AUTH_LOGIN_SUCCESS,
    userId,
    userEmail,
    outcome: 'success',
    ...ctx,
    details: { method },
  });
}

/**
 * Log failed authentication attempt
 */
export async function logAuthFailure(
  req: Request,
  email: string | null,
  reason: string
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.AUTH_LOGIN_FAILURE,
    userEmail: email,
    outcome: 'failure',
    errorMessage: reason,
    ...ctx,
    details: { reason },
  });
}

/**
 * Log authorization denial
 */
export async function logAccessDenied(
  req: Request,
  userId: string | null,
  reason: string,
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.AUTHZ_ACCESS_DENIED,
    userId,
    outcome: 'blocked',
    errorMessage: reason,
    resourceType,
    resourceId,
    ...ctx,
    details: { reason },
  });
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
  req: Request,
  userId: string | null,
  endpoint: string,
  limit: number
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.RATE_LIMIT_EXCEEDED,
    userId,
    outcome: 'blocked',
    ...ctx,
    details: { endpoint, limit },
  });
}

/**
 * Log file upload
 */
export async function logFileUpload(
  req: Request,
  userId: string,
  companyId: string,
  filename: string,
  success: boolean,
  reason?: string
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: success ? SecurityEventType.FILE_UPLOAD : SecurityEventType.FILE_VALIDATION_FAILURE,
    userId,
    companyId,
    outcome: success ? 'success' : 'failure',
    errorMessage: reason,
    resourceType: 'document',
    ...ctx,
    details: { filename, reason },
  });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  req: Request,
  userId: string | null,
  description: string,
  details?: Record<string, unknown>
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.SUSPICIOUS_REQUEST,
    severity: SecurityEventSeverity.HIGH,
    userId,
    outcome: 'warning',
    errorMessage: description,
    ...ctx,
    details: { description, ...details },
  });
}

/**
 * Log admin action
 */
export async function logAdminAction(
  req: Request,
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.AUTHZ_ADMIN_ACTION,
    userId,
    outcome: 'success',
    resourceType,
    resourceId,
    ...ctx,
    details: { action, ...details },
  });
}

/**
 * Log data access (for sensitive resources)
 */
export async function logDataAccess(
  req: Request,
  userId: string,
  companyId: string,
  resourceType: string,
  resourceId: string,
  action: 'read' | 'create' | 'update' | 'delete'
): Promise<void> {
  const ctx = extractRequestContext(req);
  const typeMap: Record<string, SecurityEventType> = {
    read: SecurityEventType.DATA_ACCESS,
    create: SecurityEventType.DATA_CREATE,
    update: SecurityEventType.DATA_UPDATE,
    delete: SecurityEventType.DATA_DELETE,
  };
  
  await logSecurityEvent({
    type: typeMap[action] || SecurityEventType.DATA_ACCESS,
    userId,
    companyId,
    outcome: 'success',
    resourceType,
    resourceId,
    ...ctx,
    details: { action },
  });
}

/**
 * Get local logs (for debugging/admin view)
 */
export function getLocalLogs(): SecurityEvent[] {
  return [...localLogs];
}

/**
 * Query audit logs from Firestore
 */
export async function queryAuditLogs(options: {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  companyId?: string;
  eventTypes?: SecurityEventType[];
  severities?: SecurityEventSeverity[];
  limit?: number;
}): Promise<SecurityEvent[]> {
  if (!isFirestoreAvailable()) {
    // Return filtered local logs if Firestore unavailable
    return localLogs.filter(log => {
      if (options.userId && log.userId !== options.userId) return false;
      if (options.companyId && log.companyId !== options.companyId) return false;
      if (options.eventTypes && !options.eventTypes.includes(log.type)) return false;
      if (options.severities && !options.severities.includes(log.severity)) return false;
      return true;
    }).slice(0, options.limit || 100);
  }
  
  const firestore = requireFirestore();
  let query = firestore.collection('security_audit_logs')
    .orderBy('timestamp', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  
  if (options.startDate) {
    query = query.where('timestamp', '>=', options.startDate.toISOString());
  }
  if (options.endDate) {
    query = query.where('timestamp', '<=', options.endDate.toISOString());
  }
  if (options.userId) {
    query = query.where('userId', '==', options.userId);
  }
  if (options.companyId) {
    query = query.where('companyId', '==', options.companyId);
  }
  
  query = query.limit(options.limit || 100);
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data() as SecurityEvent);
}

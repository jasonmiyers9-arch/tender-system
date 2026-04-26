import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { 
  queryAuditLogs, 
  getLocalLogs, 
  SecurityEventType, 
  SecurityEventSeverity,
  logAdminAction 
} from '@/lib/server/securityAudit';

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * GET /api/admin/security-logs
 * 
 * Query security audit logs with optional filters.
 * 
 * Query Parameters:
 * - startDate: ISO date string for start of range
 * - endDate: ISO date string for end of range
 * - userId: Filter by user ID
 * - companyId: Filter by company ID
 * - eventType: Comma-separated list of event types
 * - severity: Comma-separated list of severity levels
 * - limit: Max results (default 100, max 500)
 */
export async function GET(req: Request) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  
  const startDateStr = url.searchParams.get('startDate');
  const endDateStr = url.searchParams.get('endDate');
  const userId = url.searchParams.get('userId') || undefined;
  const companyId = url.searchParams.get('companyId') || undefined;
  const eventTypesStr = url.searchParams.get('eventType');
  const severitiesStr = url.searchParams.get('severity');
  const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 100), 500);
  const source = url.searchParams.get('source'); // 'local' to get in-memory logs

  // Log admin access to security logs
  await logAdminAction(req, user!.id, 'view_security_logs', 'security_audit', undefined, {
    filters: { userId, companyId, startDate: startDateStr, endDate: endDateStr },
  });

  // Parse event types
  let eventTypes: SecurityEventType[] | undefined;
  if (eventTypesStr) {
    const validTypes = Object.values(SecurityEventType);
    eventTypes = eventTypesStr
      .split(',')
      .map(t => t.trim() as SecurityEventType)
      .filter(t => validTypes.includes(t));
  }

  // Parse severities
  let severities: SecurityEventSeverity[] | undefined;
  if (severitiesStr) {
    const validSeverities = Object.values(SecurityEventSeverity);
    severities = severitiesStr
      .split(',')
      .map(s => s.trim() as SecurityEventSeverity)
      .filter(s => validSeverities.includes(s));
  }

  try {
    // Option to get local in-memory logs (useful if Firestore is unavailable)
    if (source === 'local') {
      const localLogs = getLocalLogs();
      return NextResponse.json({
        logs: localLogs.slice(0, limit),
        total: localLogs.length,
        source: 'local',
      });
    }

    const logs = await queryAuditLogs({
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      userId,
      companyId,
      eventTypes,
      severities,
      limit,
    });

    return NextResponse.json({
      logs,
      total: logs.length,
      source: 'firestore',
      filters: {
        startDate: startDateStr,
        endDate: endDateStr,
        userId,
        companyId,
        eventTypes,
        severities,
      },
    });
  } catch (err) {
    console.error('Failed to query security logs:', err);
    
    // Fallback to local logs on error
    const localLogs = getLocalLogs();
    return NextResponse.json({
      logs: localLogs.slice(0, limit),
      total: localLogs.length,
      source: 'local_fallback',
      error: 'Failed to query Firestore, showing local logs',
    });
  }
}

/**
 * GET available event types and severities for filtering
 */
export async function OPTIONS(_req: Request) {
  return NextResponse.json({
    eventTypes: Object.values(SecurityEventType),
    severities: Object.values(SecurityEventSeverity),
    description: 'Security audit log query endpoint. Use GET with query parameters to filter logs.',
  });
}

export type EventLevel = 'info' | 'warning' | 'error';

export interface FrontendEvent {
  timestamp: string;
  level: EventLevel;
  message: string;
  route: string | null;
  stack?: string | null;
}

export interface HeartbeatRecord {
  at: string;
  route: string | null;
  user_agent: string | null;
}

const MAX_EVENTS = 200;
const events: FrontendEvent[] = [];
let lastHeartbeat: HeartbeatRecord | null = null;

export function recordHeartbeat(payload: { route?: string | null; user_agent?: string | null }): void {
  const now = new Date();
  const formatted = now.toISOString();
  lastHeartbeat = {
    at: formatted,
    route: payload.route ?? null,
    user_agent: payload.user_agent ?? null,
  };

  const message = payload.route
    ? `Frontend heartbeat received for ${payload.route}`
    : 'Frontend heartbeat received';

  events.push({
    timestamp: formatted,
    level: 'info',
    message,
    route: payload.route ?? null,
  });

  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function getFrontendStatus(request: Request) {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const frontendUrl = `${proto}://${host}`;

  const checkedAt = new Date().toISOString();
  const secondsSince = lastHeartbeat
    ? Math.floor((new Date(checkedAt).getTime() - new Date(lastHeartbeat.at).getTime()) / 1000)
    : null;

  return {
    frontend_url: frontendUrl,
    reachable: true,
    status_code: 200,
    latency_ms: null,
    probe_error: null,
    checked_at: checkedAt,
    last_heartbeat: {
      at: lastHeartbeat?.at ?? null,
      route: lastHeartbeat?.route ?? null,
      user_agent: lastHeartbeat?.user_agent ?? null,
      build_id:
        process.env.NEXT_PUBLIC_BUILD_ID ||
        process.env.BUILD_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.COMMIT_REF ||
        null,
      seconds_since: secondsSince,
    },
    events_count: events.length,
  };
}

export function getFrontendEvents(limit = 20) {
  return [...events].slice(-Math.max(0, limit)).reverse();
}

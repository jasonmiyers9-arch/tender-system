/**
 * Rate Limiting Middleware
 * 
 * Implements a sliding window rate limiter for API endpoints.
 * Uses Firestore transactions in production and an in-memory store in development.
 */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getFirestore, isFirestoreAvailable } from './firebaseAdmin';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Custom key generator (defaults to IP-based) */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom handler for rate limit exceeded */
  handler?: (req: Request, retryAfter: number) => NextResponse;
}

// In-memory store for rate limit tracking
// Note: For production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks (runs every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries older than 1 hour to prevent stale data
      if (now - entry.windowStart > 60 * 60 * 1000) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Unref so it doesn't prevent process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Extract client IP from request headers
 */
function getClientIP(req: Request): string {
  // Check various headers that might contain the real IP
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be comma-separated list; take the first IP
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  // Fallback for local development
  return '127.0.0.1';
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const RateLimits = {
  /** Standard API endpoints: 100 requests per minute */
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
  /** Authentication endpoints: 10 attempts per minute */
  auth: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  /** File upload endpoints: 20 uploads per minute */
  upload: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  },
  /** AI/expensive operations: 30 requests per minute */
  ai: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  /** Admin operations: 200 requests per minute */
  admin: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  /** Strict limit for sensitive operations: 5 per minute */
  strict: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
} as const;

/**
 * Check if a request should be rate limited
 * 
 * @param req - The incoming request
 * @param config - Rate limit configuration
 * @returns Object with limited boolean and optional error response
 */
export function checkRateLimit(
  req: Request,
  config: RateLimitConfig
): { limited: boolean; error?: NextResponse; remaining: number; retryAfter?: number } {
  startCleanupTimer();
  
  // Allow skipping rate limit for certain requests
  if (config.skip?.(req)) {
    return { limited: false, remaining: config.maxRequests };
  }

  const keyGenerator = config.keyGenerator || ((r: Request) => getClientIP(r));
  const key = keyGenerator(req);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry exists or window has expired, create new entry
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = { count: 1, windowStart: now };
    rateLimitStore.set(key, entry);
    return { limited: false, remaining: config.maxRequests - 1 };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((config.windowMs - (now - entry.windowStart)) / 1000);
    
    const handler = config.handler || defaultRateLimitHandler;
    return {
      limited: true,
      remaining: 0,
      retryAfter,
      error: handler(req, retryAfter),
    };
  }

  return { limited: false, remaining };
}

/**
 * Default handler for rate limit exceeded
 */
function defaultRateLimitHandler(_req: Request, retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      detail: 'Too many requests. Please try again later.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

/**
 * Middleware wrapper for rate limiting
 * 
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   const rateLimitResult = await rateLimit(req, RateLimits.auth);
 *   if (rateLimitResult) return rateLimitResult;
 *   
 *   // Continue with request handling...
 * }
 * ```
 */
export async function rateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'production') {
    if (!isFirestoreAvailable()) {
      return NextResponse.json({ detail: 'Rate limiting persistence is unavailable' }, { status: 503 });
    }
    try {
      const rawKey = (config.keyGenerator || ((r: Request) => getClientIP(r)))(req);
      const endpoint = new URL(req.url).pathname;
      const id = createHash('sha256').update(`${endpoint}:${rawKey}`).digest('hex');
      const db = getFirestore()!;
      const ref = db.collection('rate_limits').doc(id);
      const now = Date.now();
      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = snapshot.data() as RateLimitEntry | undefined;
        const entry = !current || now - current.windowStart >= config.windowMs
          ? { count: 1, windowStart: now }
          : { count: current.count + 1, windowStart: current.windowStart };
        transaction.set(ref, {
          ...entry,
          expiresAt: new Date(entry.windowStart + config.windowMs + 60_000),
        });
        return entry;
      });
      if (result.count > config.maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((config.windowMs - (now - result.windowStart)) / 1000));
        return (config.handler || defaultRateLimitHandler)(req, retryAfter);
      }
      return null;
    } catch {
      return NextResponse.json({ detail: 'Rate limiting service unavailable' }, { status: 503 });
    }
  }

  const result = checkRateLimit(req, config);
  
  if (result.limited && result.error) {
    return result.error;
  }
  
  return null;
}

/**
 * Create a rate limiter with user-based tracking (requires authentication)
 * 
 * @param userId - The authenticated user's ID
 * @param endpoint - Endpoint identifier for per-endpoint limits
 * @param config - Rate limit configuration
 */
export function checkUserRateLimit(
  userId: string,
  endpoint: string,
  config: Omit<RateLimitConfig, 'keyGenerator'>
): { limited: boolean; error?: NextResponse; remaining: number; retryAfter?: number } {
  const mockReq = new Request('http://localhost');
  return checkRateLimit(mockReq, {
    ...config,
    keyGenerator: () => `user:${userId}:${endpoint}`,
  });
}

/**
 * Create a composite rate limiter that checks both IP and user limits
 */
export async function compositeRateLimit(
  req: Request,
  userId: string | null,
  endpoint: string,
  ipConfig: RateLimitConfig,
  userConfig?: Omit<RateLimitConfig, 'keyGenerator'>
): Promise<NextResponse | null> {
  // Always check IP-based limit
  const ipResult = checkRateLimit(req, ipConfig);
  if (ipResult.limited && ipResult.error) {
    return ipResult.error;
  }

  // Check user-based limit if authenticated
  if (userId && userConfig) {
    const userResult = checkUserRateLimit(userId, endpoint, userConfig);
    if (userResult.limited && userResult.error) {
      return userResult.error;
    }
  }

  return null;
}

/**
 * Get current rate limit status for monitoring
 */
export function getRateLimitStatus(key: string): RateLimitEntry | null {
  return rateLimitStore.get(key) || null;
}

/**
 * Clear rate limit for a specific key (admin use)
 */
export function clearRateLimit(key: string): boolean {
  return rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (admin use, use with caution)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

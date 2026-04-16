/**
 * Next.js Middleware for Security Headers and CSP Nonces
 * 
 * This middleware adds dynamic CSP nonces to requests, enabling
 * stricter Content Security Policy without 'unsafe-inline'.
 * 
 * Note: For Netlify deployments, static headers in netlify.toml
 * take precedence. This middleware provides additional runtime
 * security for development and non-Netlify deployments.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Paths that should skip the middleware
 */
const SKIP_PATHS = [
  '/_next/',
  '/api/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

/**
 * Check if the path should skip middleware processing
 */
function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some(path => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip for static assets and API routes
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }
  
  // Generate a unique nonce for this request
  const nonce = generateNonce();
  
  // Store nonce in headers for use in _document.tsx or layout.tsx
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  
  // Create response with updated headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Add security headers (these may be overridden by Netlify in production)
  // These serve as fallback for development and other deployment targets
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy, but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // Content Security Policy with nonce
  // Note: 'strict-dynamic' allows scripts loaded by nonce-verified scripts
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://*.firebaseapp.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, // unsafe-inline needed for CSS-in-JS
    `img-src 'self' data: https: blob:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://openrouter.ai wss://*.firebaseio.com`,
    `frame-src https://accounts.google.com https://*.firebaseapp.com`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
  
  // Only set CSP in development (Netlify handles production)
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('Content-Security-Policy', csp);
  }
  
  // Pass the nonce to the response for client-side access
  response.headers.set('x-nonce', nonce);
  
  return response;
}

/**
 * Configure which routes use this middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

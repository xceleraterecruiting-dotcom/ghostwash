/**
 * API Route Guards
 *
 * Helpers for protecting API routes with authentication and site access.
 */

import { NextResponse } from 'next/server';
import { verifySiteAccess, getUser } from './index';

/**
 * Verify user is authenticated and has access to the site.
 * Returns error response if unauthorized, or auth info if authorized.
 */
export async function withSiteAuth(siteId: string): Promise<
  | { authorized: true; userId: string; organizationId: string; role: string }
  | { authorized: false; response: NextResponse }
> {
  const { authorized, userId, organizationId, role } = await verifySiteAccess(siteId);

  if (!authorized) {
    if (!userId) {
      // Not authenticated at all
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized', code: 'NOT_AUTHENTICATED' },
          { status: 401 }
        ),
      };
    }
    // Authenticated but no access to this site
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'NO_SITE_ACCESS' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    userId: userId!,
    organizationId: organizationId!,
    role: role!,
  };
}

/**
 * Simple auth check (no site access verification).
 * Use for routes that don't have a siteId.
 */
export async function withAuth(): Promise<
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse }
> {
  const user = await getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    userId: user.id,
  };
}

/**
 * Verify cron job authorization.
 * Checks for CRON_SECRET bearer token.
 */
export function verifyCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow if no secret configured
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // In production, require secret
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured in production!');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

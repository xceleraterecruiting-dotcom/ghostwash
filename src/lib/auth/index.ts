/**
 * Authentication Utilities
 *
 * Server-side auth functions for API routes and server components.
 */

import { createAuthClient, createServerClient } from '@/lib/db/client';
import { User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

export interface SiteAccessResult {
  authorized: boolean;
  userId: string | null;
  organizationId: string | null;
  role: string | null;
}

/**
 * Get the current authenticated user from cookies.
 * Use in API routes and server components.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Require authentication. Returns user or throws.
 * Use at the start of protected API routes.
 */
export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Verify user has access to a specific site.
 * Checks org_members table for membership.
 */
export async function verifySiteAccess(siteId: string): Promise<SiteAccessResult> {
  const user = await getUser();

  if (!user) {
    return { authorized: false, userId: null, organizationId: null, role: null };
  }

  const supabase = createServerClient();

  // Get site's organization
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('organization_id')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return { authorized: false, userId: user.id, organizationId: null, role: null };
  }

  // Check if user is a member of this organization
  const { data: membership, error: memberError } = await supabase
    .from('org_members')
    .select('role')
    .eq('organization_id', site.organization_id)
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) {
    // Fallback: check if user owns the org directly (for migration period)
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', site.organization_id)
      .eq('user_id', user.id)
      .single();

    if (org) {
      return {
        authorized: true,
        userId: user.id,
        organizationId: site.organization_id,
        role: 'owner',
      };
    }

    return { authorized: false, userId: user.id, organizationId: site.organization_id, role: null };
  }

  return {
    authorized: true,
    userId: user.id,
    organizationId: site.organization_id,
    role: membership.role,
  };
}

/**
 * Get all organizations the user has access to.
 */
export async function getUserOrganizations(userId: string) {
  const supabase = createServerClient();

  const { data: memberships } = await supabase
    .from('org_members')
    .select(`
      role,
      organizations (
        id,
        name,
        sites (id, name)
      )
    `)
    .eq('user_id', userId);

  return memberships || [];
}

/**
 * Get the user's first site ID (for redirects after login).
 */
export async function getFirstSiteId(userId: string): Promise<string | null> {
  const supabase = createServerClient();

  // Check org_members first
  const { data: membership } = await supabase
    .from('org_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (membership) {
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .limit(1)
      .single();

    return site?.id || null;
  }

  // Fallback: check organizations.user_id
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (org) {
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('organization_id', org.id)
      .limit(1)
      .single();

    return site?.id || null;
  }

  return null;
}

/**
 * Claim an organization by matching owner_email to user email.
 * Used during signup to link existing orgs.
 */
export async function claimOrganizationByEmail(userId: string, email: string): Promise<boolean> {
  const supabase = createServerClient();

  // Find org with matching owner_email that has no user_id yet
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_email', email)
    .is('user_id', null)
    .single();

  if (!org) {
    return false;
  }

  // Set user_id on org
  await supabase
    .from('organizations')
    .update({ user_id: userId })
    .eq('id', org.id);

  // Create org_member entry
  await supabase
    .from('org_members')
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: 'owner',
    });

  return true;
}

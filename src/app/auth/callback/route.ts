import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore errors in middleware
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if user has existing org via org_members
        const { data: membership } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (membership) {
          // Get first site
          const { data: site } = await supabase
            .from('sites')
            .select('id')
            .eq('organization_id', membership.organization_id)
            .limit(1)
            .single();

          if (site) {
            return NextResponse.redirect(`${origin}/dashboard/${site.id}`);
          }
        }

        // Check if user owns any org directly
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (org) {
          const { data: site } = await supabase
            .from('sites')
            .select('id')
            .eq('organization_id', org.id)
            .limit(1)
            .single();

          if (site) {
            return NextResponse.redirect(`${origin}/dashboard/${site.id}`);
          }
        }

        // Check if there's an unclaimed org matching user's email
        const { data: unclaimedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_email', user.email)
          .is('user_id', null)
          .single();

        if (unclaimedOrg) {
          // Claim the org
          await supabase
            .from('organizations')
            .update({ user_id: user.id })
            .eq('id', unclaimedOrg.id);

          // Create org_member entry
          await supabase
            .from('org_members')
            .insert({
              organization_id: unclaimedOrg.id,
              user_id: user.id,
              role: 'owner',
            });

          // Get first site
          const { data: site } = await supabase
            .from('sites')
            .select('id')
            .eq('organization_id', unclaimedOrg.id)
            .limit(1)
            .single();

          if (site) {
            return NextResponse.redirect(`${origin}/dashboard/${site.id}`);
          }
        }
      }

      // No org found, redirect to onboarding
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Error or no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

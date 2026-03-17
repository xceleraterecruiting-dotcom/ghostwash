import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { withSiteAuth } from '@/lib/auth/api-guard';

// Get all settings for a site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createServerClient();

    // Get site with org
    const { data: site } = await supabase
      .from('sites')
      .select('*, organizations(*)')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get tier assignments
    const { data: tiers } = await supabase
      .from('tier_assignments')
      .select('*')
      .eq('site_id', siteId);

    // Get guardrails (site-level and org-level)
    const { data: guardrails } = await supabase
      .from('guardrails')
      .select('*')
      .eq('organization_id', site.organization_id)
      .or(`site_id.eq.${siteId},site_id.is.null`);

    // Get templates
    const { data: templates } = await supabase
      .from('intervention_templates')
      .select('*')
      .eq('organization_id', site.organization_id)
      .order('template_type')
      .order('priority', { ascending: false });

    return NextResponse.json({
      site,
      tiers: tiers || [],
      guardrails: guardrails || [],
      templates: templates || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update tier assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { type, data } = body;

    const supabase = createServerClient();

    // Get site org
    const { data: site } = await supabase
      .from('sites')
      .select('organization_id')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (type === 'tier') {
      const { decision_type, tier } = data;
      const { error } = await supabase
        .from('tier_assignments')
        .upsert(
          {
            organization_id: site.organization_id,
            site_id: siteId,
            decision_type,
            tier,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,site_id,decision_type' }
        );

      if (error) throw error;
    } else if (type === 'guardrail') {
      const { rule_key, rule_value, category } = data;
      const { error } = await supabase
        .from('guardrails')
        .upsert(
          {
            organization_id: site.organization_id,
            site_id: siteId,
            category,
            rule_key,
            rule_value,
          },
          { onConflict: 'organization_id,site_id,rule_key' }
        );

      if (error) throw error;
    } else if (type === 'template') {
      const { id, ...templateData } = data;
      if (id) {
        const { error } = await supabase
          .from('intervention_templates')
          .update(templateData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('intervention_templates')
          .insert({ ...templateData, organization_id: site.organization_id });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

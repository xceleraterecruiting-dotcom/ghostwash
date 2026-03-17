import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';

// Get membership plans for a site (public endpoint for checkout page)
export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;
    const supabase = createServerClient();

    // Get site info
    const { data: site } = await supabase
      .from('sites')
      .select('id, name, address, organization_id')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get membership plans (from a plans table or return defaults)
    // For now, return default plans that operators can customize later
    const defaultPlans = [
      {
        id: 'basic',
        name: 'Basic Wash',
        description: 'Exterior wash with basic soap and rinse',
        price_cents: 2999,
        interval: 'month',
        features: ['Unlimited basic washes', 'Foam soap', 'High-pressure rinse', 'Air dry'],
      },
      {
        id: 'plus',
        name: 'Plus Wash',
        description: 'Everything in Basic plus tire shine and wax',
        price_cents: 3999,
        interval: 'month',
        features: [
          'Unlimited plus washes',
          'Everything in Basic',
          'Tire shine',
          'Triple foam wax',
          'Spot-free rinse',
        ],
        popular: true,
      },
      {
        id: 'unlimited',
        name: 'Unlimited VIP',
        description: 'Our best wash with all premium services',
        price_cents: 4999,
        interval: 'month',
        features: [
          'Unlimited VIP washes',
          'Everything in Plus',
          'Ceramic coating',
          'Undercarriage wash',
          'Hot wax treatment',
          'Interior vacuum (staff-assisted)',
        ],
      },
    ];

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
      },
      plans: defaultPlans,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

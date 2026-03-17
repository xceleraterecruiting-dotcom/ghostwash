import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getUser } from '@/lib/auth';

const ADMIN_EMAIL = 'ghostwash.ai@gmail.com';

export async function GET() {
  try {
    // Check authentication
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Waitlist fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
    }

    return NextResponse.json({ entries: data });
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

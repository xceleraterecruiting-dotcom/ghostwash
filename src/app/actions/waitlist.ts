'use server';

import { createServerClient } from '@/lib/db/client';

export type WaitlistFormData = {
  name: string;
  email: string;
  washName: string;
  locationCount: string;
  posType: string;
};

export type WaitlistResult = {
  success: boolean;
  message: string;
};

export async function submitWaitlist(data: WaitlistFormData): Promise<WaitlistResult> {
  try {
    const supabase = createServerClient();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('waitlist')
      .select('email')
      .eq('email', data.email.toLowerCase())
      .single();

    if (existing) {
      return {
        success: true,
        message: "You're already on the list! We'll be in touch within 24 hours.",
      };
    }

    // Insert new waitlist entry
    const { error } = await supabase.from('waitlist').insert({
      name: data.name,
      email: data.email.toLowerCase(),
      wash_name: data.washName,
      location_count: data.locationCount,
      pos_type: data.posType,
    });

    if (error) {
      console.error('Waitlist insert error:', error);
      return {
        success: false,
        message: 'Something went wrong. Please try again.',
      };
    }

    // TODO: Send confirmation email via your email provider
    // await sendConfirmationEmail(data.email, data.name);

    return {
      success: true,
      message: "You're on the list. We're onboarding our founding operators now and will reach out within 24 hours.",
    };
  } catch (error) {
    console.error('Waitlist submission error:', error);
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    };
  }
}

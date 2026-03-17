'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import Image from 'next/image';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required
        setSuccess(true);
        setLoading(false);
        return;
      }

      // User created and signed in immediately
      if (data.user && data.session) {
        // Check if there's an existing org with this email
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_email', email)
          .is('user_id', null)
          .single();

        if (existingOrg) {
          // Claim the existing org
          await supabase
            .from('organizations')
            .update({ user_id: data.user.id })
            .eq('id', existingOrg.id);

          // Create org_member entry
          await supabase
            .from('org_members')
            .insert({
              organization_id: existingOrg.id,
              user_id: data.user.id,
              role: 'owner',
            });

          // Get first site and redirect
          const { data: site } = await supabase
            .from('sites')
            .select('id')
            .eq('organization_id', existingOrg.id)
            .limit(1)
            .single();

          if (site) {
            router.push(`/dashboard/${site.id}`);
            return;
          }
        }

        // No existing org, redirect to onboarding
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:64px_64px] opacity-20" />

        <div className="w-full max-w-md text-center relative z-10">
          <div className="flex justify-center mb-6">
            <Image src="/logo.svg" alt="GhostWash" width={60} height={84} priority />
          </div>
          <div className="bg-success/10 border border-success/20 rounded-2xl p-8 shadow-2xl shadow-black/40">
            <svg
              className="w-12 h-12 text-success mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-xl font-bold text-foreground mb-2">Check Your Email</h2>
            <p className="text-muted">
              We sent a confirmation link to <span className="text-foreground">{email}</span>.
              Click the link to complete your registration.
            </p>
          </div>
          <p className="text-muted-foreground text-sm mt-6">
            Didn't receive the email?{' '}
            <button
              onClick={() => setSuccess(false)}
              className="text-accent hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:64px_64px] opacity-20" />

      {/* Accent glow */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.svg" alt="GhostWash" width={60} height={84} priority />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted mt-2">Start your free trial today</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl p-8 space-y-5 shadow-2xl shadow-black/40">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
              placeholder="you@carwash.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-4 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-muted-foreground text-xs text-center">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>

        {/* Login Link */}
        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-muted-foreground text-xs mt-6">
          &copy; 2026 GhostWash. All rights reserved.
        </p>
      </div>
    </div>
  );
}

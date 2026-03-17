'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Check if user has any organizations
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check org_members first
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
            router.push(`/dashboard/${site.id}`);
            return;
          }
        }

        // Fallback: check organizations.user_id
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
            router.push(`/dashboard/${site.id}`);
            return;
          }
        }

        // No orgs found, redirect to onboarding
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
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
          autoComplete="current-password"
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
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:64px_64px] opacity-20" />

      {/* Accent glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.svg" alt="GhostWash" width={60} height={84} priority />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted mt-2">Sign in to your GhostWash account</p>
        </div>

        {/* Login Form wrapped in Suspense */}
        <Suspense fallback={
          <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl shadow-black/40">
            <div className="h-12 bg-surface-hover rounded-lg mb-5 animate-pulse" />
            <div className="h-12 bg-surface-hover rounded-lg mb-5 animate-pulse" />
            <div className="h-12 bg-surface-hover rounded-lg animate-pulse" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Sign Up Link */}
        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-center text-muted-foreground text-xs mt-6">
          &copy; 2026 GhostWash. All rights reserved.
        </p>
      </div>
    </div>
  );
}

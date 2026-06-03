'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginScreen } from '@/app/components/LoginScreen';
import { createClient } from '@/lib/supabase/client';

export function AuthLandingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const requestedNextPath = searchParams.get('next') || '/';
  const nextPath = requestedNextPath.startsWith('/') ? requestedNextPath : '/';

  const handleGoogleSignIn = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
  };

  const handleSignUp = () => {
    router.push(`/auth/sign-up?next=${encodeURIComponent(nextPath)}`);
  };

  const handleLogIn = () => {
    router.push(`/auth/log-in?next=${encodeURIComponent(nextPath)}`);
  };

  return (
    <LoginScreen
      onContinueWithGoogle={handleGoogleSignIn}
      onSignUp={handleSignUp}
      onLogIn={handleLogIn}
    />
  );
}

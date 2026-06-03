'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
}

const COPY = {
  login: {
    title: 'Welcome back',
    description: 'Sign in with Google or your email and password.',
    submit: 'Log In',
    alternatePrompt: "Don't have an account?",
    alternateHref: '/auth/sign-up',
    alternateAction: 'Sign up',
  },
  signup: {
    title: 'Create your account',
    description: 'Use Google or sign up manually with your email.',
    submit: 'Create Account',
    alternatePrompt: 'Already have an account?',
    alternateHref: '/auth/log-in',
    alternateAction: 'Log in',
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const requestedNextPath = searchParams.get('next') || '/';
  const nextPath = requestedNextPath.startsWith('/') ? requestedNextPath : '/';

  const resetMessages = () => {
    setErrorMessage(null);
    setNoticeMessage(null);
  };

  const handleGoogleSignIn = async () => {
    resetMessages();
    setIsGoogleSubmitting(true);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsGoogleSubmitting(false);
      return;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    setIsSubmitting(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
      return;
    }

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.replace(nextPath);
      router.refresh();
      return;
    }

    setNoticeMessage('Check your inbox to confirm your email, then log in.');
    setIsSubmitting(false);
  };

  const copy = COPY[mode];

  return (
    <div className="app-shell">
      <div className="w-full max-w-md">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="font-manrope text-2xl">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {noticeMessage ? (
              <Alert>
                <AlertDescription>{noticeMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
            >
              {isGoogleSubmitting ? 'Redirecting...' : 'Continue with Google'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">or continue with email</div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting}>
                {isSubmitting ? 'Please wait...' : copy.submit}
              </Button>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-sm text-muted-foreground">
              {copy.alternatePrompt}{' '}
              <Link href={copy.alternateHref} className="font-medium text-foreground underline underline-offset-4">
                {copy.alternateAction}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

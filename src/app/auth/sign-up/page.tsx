import { redirect } from 'next/navigation';
import { AuthForm } from '@/app/components/auth/AuthForm';
import { createClient } from '@/lib/supabase/server';

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return <AuthForm mode="signup" />;
}

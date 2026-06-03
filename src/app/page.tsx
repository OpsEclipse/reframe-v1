import { redirect } from 'next/navigation';
import App from './App';
import { Button } from './components/ui/button';
import { createClient } from '@/lib/supabase/server';

function getUserDisplayName(email: string | undefined, metadata: unknown): string {
  if (metadata && typeof metadata === 'object') {
    const typed = metadata as {
      full_name?: unknown;
      name?: unknown;
      user_name?: unknown;
    };

    if (typeof typed.full_name === 'string' && typed.full_name.trim()) {
      return typed.full_name.trim();
    }

    if (typeof typed.name === 'string' && typed.name.trim()) {
      return typed.name.trim();
    }

    if (typeof typed.user_name === 'string' && typed.user_name.trim()) {
      return typed.user_name.trim();
    }
  }

  if (!email) {
    return 'there';
  }

  const [localPart] = email.split('@');
  if (!localPart) {
    return 'there';
  }

  return localPart;
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const userDisplayName = getUserDisplayName(user.email, user.user_metadata);

  return (
    <div className="relative">
      <div className="absolute right-8 top-8 z-20">
        {user.email ? (
          <p className="mb-2 text-right text-xs font-medium text-white/70">
            {user.email}
          </p>
        ) : null}
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
      <App userName={userDisplayName} />
    </div>
  );
}

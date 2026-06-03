import { redirect } from 'next/navigation';
import { AuthLandingScreen } from '@/app/components/auth/AuthLandingScreen';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <div className="app-shell">
      <div
        className="app-stage"
        style={{
          background:
            'linear-gradient(to bottom, var(--app-stage-gradient-start), var(--app-stage-gradient-end))',
        }}
      >
        <div className="app-stage-content">
          <div className="size-full">
            <AuthLandingScreen />
          </div>
        </div>
        <div className="app-stage-shadow" />
        <div aria-hidden="true" className="app-stage-border" />
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import App from './App';
import { createClient } from '@/lib/supabase/server';
import { getUserDisplayName } from '@/lib/profile/display-name';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: clientProfile } = await supabase
    .from('clients')
    .select('display_name')
    .eq('user_id', user.id)
    .eq('name', 'primary')
    .maybeSingle();

  const userDisplayName = getUserDisplayName({
    clientDisplayName: clientProfile?.display_name,
    email: user.email,
    metadata: user.user_metadata,
  });

  return <App userName={userDisplayName} userEmail={user.email ?? null} />;
}

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface ClientRow {
  client_id: string;
}

export interface IngestionActor {
  supabase: SupabaseClient;
  user: User;
}

function deriveDisplayName(user: User): string {
  const metadata = user.user_metadata as {
    full_name?: unknown;
    name?: unknown;
    user_name?: unknown;
  };

  if (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }

  if (typeof metadata?.name === 'string' && metadata.name.trim()) {
    return metadata.name.trim();
  }

  if (typeof metadata?.user_name === 'string' && metadata.user_name.trim()) {
    return metadata.user_name.trim();
  }

  const localPart = user.email?.split('@')[0];
  if (localPart && localPart.trim()) {
    return localPart.trim();
  }

  return 'User';
}

async function findExistingClient(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('client_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve client: ${error.message}`);
  }

  const existing = (data ?? [])[0] as ClientRow | undefined;
  return existing?.client_id ?? null;
}

async function ensurePrimaryClient(supabase: SupabaseClient, user: User): Promise<string> {
  const existing = await findExistingClient(supabase, user.id);
  if (existing) {
    return existing;
  }

  const displayName = deriveDisplayName(user);
  const provider = typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : 'email';

  const { data, error } = await supabase
    .from('clients')
    .upsert(
      {
        user_id: user.id,
        name: 'primary',
        display_name: displayName,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        metadata: {
          created_from_auth_provider: provider,
          created_by: 'ingestion_api',
        },
      },
      {
        onConflict: 'user_id,name',
      },
    )
    .select('client_id')
    .limit(1);

  if (error) {
    throw new Error(`Failed to create primary client: ${error.message}`);
  }

  const created = (data ?? [])[0] as ClientRow | undefined;
  if (!created?.client_id) {
    throw new Error('Primary client was not created.');
  }

  return created.client_id;
}

export async function getIngestionActor(): Promise<IngestionActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to authenticate user: ${error.message}`);
  }

  if (!user) {
    return null;
  }

  return {
    supabase,
    user,
  };
}

export function getPrimaryClientId(actor: IngestionActor): Promise<string> {
  return ensurePrimaryClient(actor.supabase, actor.user);
}

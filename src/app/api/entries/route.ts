import { NextRequest, NextResponse } from 'next/server';
import { getIngestionActor } from '@/lib/ingestion/auth';

export const runtime = 'nodejs';

interface EntryReference {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(500, Math.trunc(requestedLimit)))
      : 100;

    const { data, error } = await actor.supabase
      .from('entries')
      .select('entry_id,s3_key,source_file,entry_date,created_at,updated_at')
      .eq('user_id', actor.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: `Failed to list entries: ${error.message}` }, { status: 500 });
    }

    const references = (data ?? []) as EntryReference[];

    return NextResponse.json({
      count: references.length,
      entries: references,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch entries.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

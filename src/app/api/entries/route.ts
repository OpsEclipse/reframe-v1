import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { getIngestionBucket, getS3Client } from '@/lib/aws/clients';
import { getIngestionActor } from '@/lib/ingestion/auth';
import type { ExtractedEntry } from '@/lib/ingestion/types';

export const runtime = 'nodejs';

interface EntryReference {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  created_at: string;
  updated_at: string;
}

async function bodyToString(body: unknown): Promise<string> {
  if (!body) {
    return '';
  }

  const maybeTransformable = body as { transformToString?: () => Promise<string> };
  if (typeof maybeTransformable.transformToString === 'function') {
    return maybeTransformable.transformToString();
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }

  const maybeAsyncIterable = body as AsyncIterable<Uint8Array | string>;
  if (typeof maybeAsyncIterable[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of maybeAsyncIterable) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  throw new Error('Unsupported S3 body format.');
}

function isExtractedEntry(candidate: unknown): candidate is ExtractedEntry {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const value = candidate as ExtractedEntry;
  return (
    (typeof value.date === 'string' || value.date === null) &&
    typeof value.entry_text === 'string' &&
    typeof value.source_file === 'string'
  );
}

function normalizeExtractedPayload(payload: unknown): ExtractedEntry[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const maybeArray = payload as unknown[];
  if (Array.isArray(maybeArray)) {
    return maybeArray.filter(isExtractedEntry);
  }

  const maybeEntry = payload as ExtractedEntry;
  if (isExtractedEntry(maybeEntry)) {
    return [maybeEntry];
  }

  const maybeEntriesWrapper = payload as { entries?: unknown[] };
  if (Array.isArray(maybeEntriesWrapper.entries)) {
    return maybeEntriesWrapper.entries.filter(isExtractedEntry);
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const includeContent = request.nextUrl.searchParams.get('includeContent') === 'true';
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

    if (!includeContent) {
      return NextResponse.json({
        count: references.length,
        entries: references,
      });
    }

    const s3 = getS3Client();
    const bucket = getIngestionBucket();

    const hydratedEntries = await Promise.all(
      references.map(async (reference) => {
        try {
          const object = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: reference.s3_key,
            }),
          );

          const raw = await bodyToString(object.Body);
          if (!raw) {
            return {
              ...reference,
              content: [] as ExtractedEntry[],
            };
          }

          const parsed = JSON.parse(raw) as unknown;
          return {
            ...reference,
            content: normalizeExtractedPayload(parsed),
          };
        } catch {
          return {
            ...reference,
            content: [] as ExtractedEntry[],
            content_error: 'Failed to read entry JSON from S3.',
          };
        }
      }),
    );

    return NextResponse.json({
      count: hydratedEntries.length,
      entries: hydratedEntries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch entries.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

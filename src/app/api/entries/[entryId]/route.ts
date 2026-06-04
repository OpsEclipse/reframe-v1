import { NextResponse } from "next/server";
import { readEntryContentFromS3 } from "@/lib/entries/content";
import { getIngestionActor } from "@/lib/ingestion/auth";

export const runtime = "nodejs";

interface EntryRouteContext {
  params: Promise<{
    entryId: string;
  }>;
}

interface EntryReferenceRow {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Failed to authenticate user:")
  );
}

export async function GET(_request: Request, context: EntryRouteContext) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { entryId } = await context.params;
    const cleanEntryId = entryId.trim();
    if (!cleanEntryId) {
      return NextResponse.json({ error: "entryId is required." }, { status: 400 });
    }

    const { data, error } = await actor.supabase
      .from("entries")
      .select("entry_id,s3_key,source_file,entry_date")
      .eq("user_id", actor.user.id)
      .eq("entry_id", cleanEntryId)
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: `Failed to load entry reference: ${error.message}` },
        { status: 500 },
      );
    }

    const reference = (data?.[0] as EntryReferenceRow | undefined) ?? null;
    if (!reference) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    let content;
    try {
      content = await readEntryContentFromS3(reference.s3_key);
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "Entry content in S3 is not valid JSON."
          : error instanceof Error
            ? error.message
            : "Failed to read entry content from S3.";

      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!content) {
      return NextResponse.json(
        { error: "Entry content was empty or unreadable." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      entry_id: reference.entry_id,
      entry_date: reference.entry_date,
      source_file: reference.source_file,
      content,
    });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

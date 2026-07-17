import { NextRequest, NextResponse } from "next/server";
import { getIngestionActor, getPrimaryClientId } from "@/lib/ingestion/auth";
import { saveReflectionEntry } from "@/lib/reflections/session";

export const runtime = "nodejs";

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Failed to authenticate user:")
  );
}

interface SaveReflectionEntryBody {
  entry_text?: unknown;
}

interface SaveReflectionEntryContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: SaveReflectionEntryContext,
) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: SaveReflectionEntryBody;
    try {
      body = (await request.json()) as SaveReflectionEntryBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body.entry_text !== "string" || !body.entry_text.trim()) {
      return NextResponse.json({ error: "entry_text is required." }, { status: 400 });
    }

    const { sessionId } = await context.params;
    const result = await saveReflectionEntry({
      supabase: actor.supabase,
      userId: actor.user.id,
      clientId: await getPrimaryClientId(actor),
      sessionId,
      entryText: body.entry_text,
    });

    return NextResponse.json(result);
  } catch (error) {
    const isUnauthorized = isUnauthorizedError(error);
    const message =
      isUnauthorized
        ? "Unauthorized."
        : error instanceof Error
          ? error.message
          : "Failed to save reflection entry.";
    const status = isUnauthorized
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("already has a saved entry")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

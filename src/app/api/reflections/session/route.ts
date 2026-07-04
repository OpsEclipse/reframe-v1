import { NextResponse } from "next/server";
import { getIngestionActor } from "@/lib/ingestion/auth";
import { createReflectionSession } from "@/lib/reflections/session";
import { normalizeReflectionTone } from "@/lib/reflections/tone";

export const runtime = "nodejs";

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Failed to authenticate user:")
  );
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody(request);
    const tone = normalizeReflectionTone(
      typeof body === "object" && body !== null && "tone" in body
        ? body.tone
        : null,
    );
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const session = await createReflectionSession({
      supabase: actor.supabase,
      userId: actor.user.id,
      clientId: actor.clientId,
      tone,
    });

    return NextResponse.json({
      session_id: session.sessionId,
      primary_entry: {
        entry_id: session.primaryEntry.entry_id,
        entry_date: session.primaryEntry.entry_date,
        entry_text: session.primaryEntry.content.entry_text,
      },
      related_entries: session.relatedEntries,
      reflection: session.reflection,
    });
  } catch (error) {
    const isUnauthorized = isUnauthorizedError(error);
    const message =
      isUnauthorized
        ? "Unauthorized."
        : error instanceof Error
          ? error.message
          : "Failed to create reflection session.";
    const status = isUnauthorized
      ? 401
      : message.includes("Reflect needs indexed entries")
        ? 409
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

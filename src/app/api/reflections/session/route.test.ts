import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  createReflectionSession: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

vi.mock("@/lib/reflections/session", () => ({
  createReflectionSession: mocks.createReflectionSession,
}));

function buildSession() {
  return {
    sessionId: "session-1",
    primaryEntry: {
      entry_id: "entry-a",
      entry_date: "2026-06-03",
      content: { entry_text: "Entry text." },
    },
    relatedEntries: [],
    reflection: {
      primary_entry_id: "entry-a",
      blocks: [{ type: "paragraph", text: "Reflection." }],
      writing_prompt: { text: "What feels true?" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIngestionActor.mockResolvedValue({
    user: { id: "user-123" },
    clientId: "client-456",
    supabase: { from: vi.fn() },
  });
  mocks.createReflectionSession.mockResolvedValue(buildSession());
});

describe("POST /api/reflections/session", () => {
  it("passes a valid tone into reflection session creation", async () => {
    const { POST } = await import("@/app/api/reflections/session/route");

    const response = await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: JSON.stringify({ tone: "more_curious" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createReflectionSession).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "more_curious" }),
    );
  });

  it("defaults missing, invalid, and malformed tone bodies", async () => {
    const { POST } = await import("@/app/api/reflections/session/route");

    await POST(
      new Request("http://test.local/api/reflections/session", { method: "POST" }),
    );
    await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: JSON.stringify({ tone: "loud" }),
      }),
    );
    await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: "{",
      }),
    );

    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tone: "default" }),
    );
    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tone: "default" }),
    );
    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ tone: "default" }),
    );
  });
});

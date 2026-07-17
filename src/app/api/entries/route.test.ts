import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getIngestionActor: vi.fn() }));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

beforeEach(() => vi.clearAllMocks());

describe("GET /api/entries", () => {
  it("returns metadata only even when the removed includeContent flag is sent", async () => {
    const rows = [{
      entry_id: "entry-1",
      s3_key: "entries/user-123/entry-1.json",
      source_file: "journal.pdf",
      entry_date: "2026-07-13",
      created_at: "2026-07-13T12:00:00.000Z",
      updated_at: "2026-07-13T12:00:00.000Z",
    }];
    const limit = vi.fn(async () => ({ data: rows, error: null }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase: { from: vi.fn(() => ({ select })) },
    });
    const { GET } = await import("@/app/api/entries/route");

    const response = await GET(
      new NextRequest("http://test.local/api/entries?includeContent=true"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 1, entries: rows });
  });
});

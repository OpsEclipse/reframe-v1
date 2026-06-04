import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  readEntryContentFromS3: vi.fn(),
  deletePineconeEntryVector: vi.fn(),
  s3Send: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

vi.mock("@/lib/entries/content", () => ({
  readEntryContentFromS3: mocks.readEntryContentFromS3,
}));

vi.mock("@/lib/entries/embedding-clients", () => ({
  deletePineconeEntryVector: mocks.deletePineconeEntryVector,
}));

vi.mock("@/lib/aws/clients", () => ({
  getIngestionBucket: () => "journal-bucket",
  getS3Client: () => ({ send: mocks.s3Send }),
}));

function routeContext(entryId: string) {
  return {
    params: Promise.resolve({ entryId }),
  };
}

function createSupabaseWithEntry(options: {
  row: null | {
    entry_id: string;
    s3_key: string;
    source_file: string | null;
    entry_date: string | null;
    pinecone_vector_id?: string | null;
  };
  selectError?: { message: string } | null;
  deleteError?: { message: string } | null;
  deletedRows?: { entry_id: string }[];
}) {
  const selectLimit = vi.fn(async () => ({
    data: options.row ? [options.row] : [],
    error: options.selectError ?? null,
  }));
  const selectEqEntry = vi.fn(() => ({ limit: selectLimit }));
  const selectEqUser = vi.fn(() => ({ eq: selectEqEntry }));
  const select = vi.fn(() => ({ eq: selectEqUser }));

  const deleteLimit = vi.fn(async () => ({
    data:
      options.deletedRows ??
      (options.deleteError ? [] : options.row ? [{ entry_id: options.row.entry_id }] : []),
    error: options.deleteError ?? null,
  }));
  const deleteSelect = vi.fn(() => ({ limit: deleteLimit }));
  const deleteEqEntry = vi.fn(() => ({ select: deleteSelect }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqEntry }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));

  const from = vi.fn((table: string) => {
    if (table !== "entries") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select,
      delete: deleteFn,
    };
  });

  return {
    supabase: { from },
    spies: {
      from,
      select,
      selectEqUser,
      selectEqEntry,
      selectLimit,
      deleteFn,
      deleteEqUser,
      deleteEqEntry,
      deleteSelect,
      deleteLimit,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.s3Send.mockResolvedValue({});
  mocks.deletePineconeEntryVector.mockResolvedValue(undefined);
});

describe("GET /api/entries/[entryId]", () => {
  it("loads one owned entry with S3 content", async () => {
    const { GET } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });
    mocks.readEntryContentFromS3.mockResolvedValue({
      date: "2026-06-03",
      entry_text: "Old entry.",
      source_file: "journal.pdf",
    });

    const response = await GET(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entry_id: "entry-abc",
      entry_date: "2026-06-03",
      source_file: "journal.pdf",
      content: {
        date: "2026-06-03",
        entry_text: "Old entry.",
        source_file: "journal.pdf",
      },
    });
    expect(mocks.readEntryContentFromS3).toHaveBeenCalledWith(
      "entries/user-123/entry-abc.json",
      "journal.pdf",
    );
  });
});

describe("DELETE /api/entries/[entryId]", () => {
  it("rejects unauthenticated users", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    mocks.getIngestionActor.mockResolvedValue(null);

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when no owned entry exists", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({ row: null });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(404);
    expect(mocks.s3Send).not.toHaveBeenCalled();
  });

  it("deletes the S3 object, Supabase row, and Pinecone vector", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase, spies } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
        pinecone_vector_id: "entry:entry-abc",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    expect(mocks.s3Send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    expect(mocks.s3Send.mock.calls[0]?.[0].input).toEqual({
      Bucket: "journal-bucket",
      Key: "entries/user-123/entry-abc.json",
    });
    expect(spies.deleteEqUser).toHaveBeenCalledWith("user_id", "user-123");
    expect(spies.deleteEqEntry).toHaveBeenCalledWith("entry_id", "entry-abc");
    expect(mocks.deletePineconeEntryVector).toHaveBeenCalledWith({
      userId: "user-123",
      vectorId: "entry:entry-abc",
    });
    await expect(response.json()).resolves.toEqual({
      deleted: true,
      entry_id: "entry-abc",
    });
  });

  it("returns 502 and does not delete the Supabase row when S3 delete fails", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase, spies } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
        pinecone_vector_id: "entry:entry-abc",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });
    mocks.s3Send.mockRejectedValue(new Error("s3 down"));

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete entry file from S3: s3 down",
    });
    expect(spies.deleteFn).not.toHaveBeenCalled();
    expect(mocks.deletePineconeEntryVector).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase row delete fails", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
        pinecone_vector_id: "entry:entry-abc",
      },
      deleteError: { message: "delete denied" },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete entry reference: delete denied",
    });
    expect(mocks.deletePineconeEntryVector).not.toHaveBeenCalled();
  });

  it("returns 500 and does not report success when Supabase delete returns no row", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
        pinecone_vector_id: "entry:entry-abc",
      },
      deletedRows: [],
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Entry reference was not deleted.",
    });
    expect(mocks.deletePineconeEntryVector).not.toHaveBeenCalled();
  });

  it("still succeeds when only Pinecone cleanup fails", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: null,
        entry_date: null,
        pinecone_vector_id: "entry:entry-abc",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });
    mocks.deletePineconeEntryVector.mockRejectedValue(new Error("pinecone down"));

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deleted: true,
      entry_id: "entry-abc",
    });
  });
});

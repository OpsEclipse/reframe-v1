import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  getManifestWithEtag: vi.fn(),
  putManifest: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

vi.mock("@/lib/ingestion/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ingestion/manifest")>()),
  getManifestWithEtag: mocks.getManifestWithEtag,
  putManifest: mocks.putManifest,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIngestionActor.mockResolvedValue({
    user: { id: "user-123" },
    supabase: { from: vi.fn() },
  });
});

describe("GET /api/ingestion/[ingestionId]/status", () => {
  it("does not overwrite a newer manifest when its conditional update loses", async () => {
    const ingestionId = "11111111-1111-4111-8111-111111111111";
    mocks.getManifestWithEtag.mockResolvedValue({
      etag: '"etag-1"',
      manifest: {
        version: 1,
        ingestionId,
        userId: "user-123",
        clientId: "client-456",
        status: "PROCESSING",
        submittedAt: "2026-07-13T12:00:00.000Z",
        updatedAt: "2026-07-13T12:01:00.000Z",
        files: [{
          clientFileId: "file-1",
          key: "uploads/user-123/file-1.pdf",
          name: "file.pdf",
          contentType: "application/pdf",
          size: 100,
          status: "PROCESSING",
          entryKey: "entries/user-123/entry-1.json",
        }],
      },
    });
    mocks.putManifest.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        name: "PreconditionFailed",
        $metadata: { httpStatusCode: 412 },
      }),
    );
    const { GET } = await import("@/app/api/ingestion/[ingestionId]/status/route");

    const response = await GET(new Request("http://test.local") as never, {
      params: Promise.resolve({ ingestionId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.putManifest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
      { ifMatch: '"etag-1"' },
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  getPrimaryClientId: vi.fn(),
  getManifest: vi.fn(),
  getManifestWithEtag: vi.fn(),
  putManifest: vi.fn(),
  s3Send: vi.fn(),
  scheduleEntryEmbeddingIndexing: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
  getPrimaryClientId: mocks.getPrimaryClientId,
}));

vi.mock("@/lib/aws/clients", () => ({
  getIngestionBucket: () => "journal-bucket",
  getS3Client: () => ({ send: mocks.s3Send }),
}));

vi.mock("@/lib/entries/embedding-background", () => ({
  scheduleEntryEmbeddingIndexing: mocks.scheduleEntryEmbeddingIndexing,
}));

vi.mock("@/lib/ingestion/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ingestion/manifest")>()),
  getManifest: mocks.getManifest,
  getManifestWithEtag: mocks.getManifestWithEtag,
  putManifest: mocks.putManifest,
}));

const ingestionId = "11111111-1111-4111-8111-111111111111";

function createManifest(overrides: Record<string, unknown> = {}) {
  return {
    version: 1 as const,
    ingestionId,
    userId: "user-123",
    clientId: "client-456",
    status: "COMPLETED" as const,
    submittedAt: "2026-07-13T12:00:00.000Z",
    updatedAt: "2026-07-13T12:01:00.000Z",
    files: [],
    ...overrides,
  };
}

async function callRoute() {
  const { GET } = await import("@/app/api/ingestion/[ingestionId]/results/route");
  return GET(new Request("http://test.local") as never, {
    params: Promise.resolve({ ingestionId }),
  });
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.getIngestionActor.mockResolvedValue({
    user: { id: "user-123" },
    supabase: { from: vi.fn() },
  });
  mocks.putManifest.mockResolvedValue('"claim-etag"');
  mocks.s3Send.mockResolvedValue({});
});

describe("GET /api/ingestion/[ingestionId]/results", () => {
  it("returns a stored summary without repeating finalization work", async () => {
    const manifest = createManifest({
      resultsFinalizationStatus: "FINALIZED",
      resultEntryCount: 12,
      resultReferencesSynced: 12,
      resultEmbeddingsQueued: 3,
    });
    mocks.getManifest.mockResolvedValue(manifest);
    mocks.getManifestWithEtag.mockResolvedValue({ manifest, etag: '"etag-1"' });

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ingestionId,
      entryCount: 12,
      referencesSynced: 12,
      embeddingsQueued: 3,
    });
    expect(mocks.putManifest).not.toHaveBeenCalled();
    expect(mocks.s3Send).not.toHaveBeenCalled();
    expect(mocks.scheduleEntryEmbeddingIndexing).not.toHaveBeenCalled();
    expect(mocks.getPrimaryClientId).not.toHaveBeenCalled();
  });

  it("returns 409 while another request is finalizing", async () => {
    const manifest = createManifest({ resultsFinalizationStatus: "FINALIZING" });
    mocks.getManifest.mockResolvedValue(manifest);
    mocks.getManifestWithEtag.mockResolvedValue({ manifest, etag: '"etag-1"' });

    const response = await callRoute();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Ingestion results are being finalized.",
      status: "FINALIZING",
    });
    expect(mocks.putManifest).not.toHaveBeenCalled();
  });

  it("reclaims an expired finalization with the manifest version check", async () => {
    const manifest = createManifest({
      resultsFinalizationStatus: "FINALIZING",
      resultsFinalizationStartedAt: "2026-07-13T00:00:00.000Z",
    });
    mocks.getManifest.mockResolvedValue(manifest);
    mocks.getManifestWithEtag.mockResolvedValue({ manifest, etag: '"etag-1"' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:11:00.000Z"));

    const response = await callRoute();

    vi.useRealTimers();
    expect(response.status).toBe(200);
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ resultsFinalizationStatus: "FINALIZING" }),
      { ifMatch: '"etag-1"' },
    );
  });

  it("returns 409 when another request wins the manifest claim", async () => {
    const manifest = createManifest();
    mocks.getManifest.mockResolvedValue(manifest);
    mocks.getManifestWithEtag.mockResolvedValue({ manifest, etag: '"etag-1"' });
    mocks.putManifest.mockRejectedValueOnce(
      Object.assign(new Error("precondition failed"), {
        name: "PreconditionFailed",
        $metadata: { httpStatusCode: 412 },
      }),
    );

    const response = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.s3Send).not.toHaveBeenCalled();
    expect(mocks.scheduleEntryEmbeddingIndexing).not.toHaveBeenCalled();
  });

  it("retries a failed finalization and stores the final summary", async () => {
    const manifest = createManifest({ resultsFinalizationStatus: "FAILED" });
    mocks.getManifest.mockResolvedValue(manifest);
    mocks.getManifestWithEtag.mockResolvedValue({ manifest, etag: '"etag-1"' });

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ingestionId,
      entryCount: 0,
      referencesSynced: 0,
      embeddingsQueued: 0,
    });
    expect(mocks.putManifest).toHaveBeenCalledTimes(2);
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ resultsFinalizationStatus: "FINALIZING" }),
      { ifMatch: '"etag-1"' },
    );
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resultsFinalizationStatus: "FINALIZED",
        resultEntryCount: 0,
      }),
      { ifMatch: '"claim-etag"' },
    );
  });

  it("keeps retry writes version-checked when the final manifest write fails", async () => {
    const initialManifest = createManifest();
    const failedManifest = createManifest({ resultsFinalizationStatus: "FAILED" });
    mocks.getManifestWithEtag
      .mockResolvedValueOnce({ manifest: initialManifest, etag: '"etag-1"' })
      .mockResolvedValueOnce({ manifest: failedManifest, etag: '"etag-2"' });
    mocks.putManifest
      .mockResolvedValueOnce('"claim-1"')
      .mockRejectedValueOnce(new Error("final write failed"))
      .mockResolvedValueOnce('"failed-1"')
      .mockResolvedValueOnce('"claim-2"')
      .mockResolvedValueOnce('"final-2"');

    const failedResponse = await callRoute();
    const retryResponse = await callRoute();

    expect(failedResponse.status).toBe(500);
    expect(retryResponse.status).toBe(200);
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ resultsFinalizationStatus: "FINALIZED" }),
      { ifMatch: '"claim-1"' },
    );
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ resultsFinalizationStatus: "FAILED" }),
      { ifMatch: '"claim-1"' },
    );
    expect(mocks.putManifest).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ resultsFinalizationStatus: "FINALIZED" }),
      { ifMatch: '"claim-2"' },
    );
    expect(mocks.scheduleEntryEmbeddingIndexing).toHaveBeenCalledTimes(2);
  });
});

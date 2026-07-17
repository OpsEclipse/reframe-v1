import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

beforeEach(() => vi.clearAllMocks());

describe("getIngestionActor", () => {
  it("authenticates without querying the clients table", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123" } },
          error: null,
        })),
      },
      from,
    });
    const { getIngestionActor } = await import("@/lib/ingestion/auth");

    await expect(getIngestionActor()).resolves.toEqual(
      expect.objectContaining({ user: { id: "user-123" } }),
    );
    expect(from).not.toHaveBeenCalled();
  });
});

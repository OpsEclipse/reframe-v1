import { describe, expect, it } from "vitest";
import { getUserDisplayName } from "@/lib/profile/display-name";

describe("getUserDisplayName", () => {
  it("prefers the Supabase client display name", () => {
    expect(
      getUserDisplayName({
        clientDisplayName: "Sam Rivera",
        email: "fallback@example.com",
        metadata: { full_name: "Fallback Name" },
      }),
    ).toBe("Sam Rivera");
  });

  it("falls back to auth metadata when the client display name is empty", () => {
    expect(
      getUserDisplayName({
        clientDisplayName: "  ",
        email: "fallback@example.com",
        metadata: { name: "Fallback Name" },
      }),
    ).toBe("Fallback Name");
  });
});

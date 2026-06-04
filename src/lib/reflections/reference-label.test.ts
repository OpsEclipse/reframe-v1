import { describe, expect, it } from "vitest";
import { getEntryReferenceLabel } from "@/lib/reflections/reference-label";

describe("getEntryReferenceLabel", () => {
  it("uses the referenced entry date instead of the entry id", () => {
    expect(
      getEntryReferenceLabel("entry-abc", new Map([["entry-abc", "2021-03-12"]])),
    ).toBe("MARCH 2021");
  });

  it("does not expose the entry id when the date is missing", () => {
    expect(getEntryReferenceLabel("entry-abc", new Map())).toBe("RECENT ENTRY");
  });
});

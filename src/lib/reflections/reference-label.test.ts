import { describe, expect, it } from "vitest";
import {
  formatEntryReferenceDate,
  getEntryReferenceLabel,
} from "@/lib/reflections/reference-label";

describe("getEntryReferenceLabel", () => {
  it("uses the referenced entry date and age instead of the entry id", () => {
    expect(
      getEntryReferenceLabel(
        "entry-abc",
        new Map([["entry-abc", "2021-03-12"]]),
        new Date("2026-06-05T12:00:00Z"),
      ),
    ).toBe("March 2021, 5 years ago");
  });

  it("does not expose the entry id when the date is missing", () => {
    expect(getEntryReferenceLabel("entry-abc", new Map())).toBe("RECENT ENTRY");
  });
});

describe("formatEntryReferenceDate", () => {
  it("uses months for entries less than one year old", () => {
    expect(
      formatEntryReferenceDate(
        "2026-01-14",
        new Date("2026-06-05T12:00:00Z"),
      ),
    ).toBe("January 2026, 5 months ago");
  });

  it("uses singular units when the age is one month or one year", () => {
    expect(
      formatEntryReferenceDate(
        "2026-05-14",
        new Date("2026-06-05T12:00:00Z"),
      ),
    ).toBe("May 2026, 1 month ago");

    expect(
      formatEntryReferenceDate(
        "2025-06-14",
        new Date("2026-06-05T12:00:00Z"),
      ),
    ).toBe("June 2025, 1 year ago");
  });
});

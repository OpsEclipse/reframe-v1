import { describe, expect, it } from "vitest";
import {
  normalizeEntryPayload,
  normalizeEntryRawContent,
} from "@/lib/entries/content";

describe("normalizeEntryPayload", () => {
  it("keeps a valid single JSON entry", () => {
    expect(
      normalizeEntryPayload({
        date: "2026-06-03",
        entry_text: "A dated entry.",
        source_file: "journal.pdf",
      }),
    ).toEqual({
      date: "2026-06-03",
      entry_text: "A dated entry.",
      source_file: "journal.pdf",
    });
  });

  it("uses the first valid entry in a JSON array", () => {
    expect(
      normalizeEntryPayload([
        {
          date: null,
          entry_text: "First entry.",
          source_file: "scan.png",
        },
        {
          date: "2026-06-03",
          entry_text: "Second entry.",
          source_file: "scan.png",
        },
      ]),
    ).toEqual({
      date: null,
      entry_text: "First entry.",
      source_file: "scan.png",
    });
  });

  it("uses the first valid entry in an entries wrapper", () => {
    expect(
      normalizeEntryPayload({
        entries: [
          {
            date: "2025-12-12",
            entry_text: "Wrapped entry.",
            source_file: "journal.pdf",
          },
        ],
      }),
    ).toEqual({
      date: "2025-12-12",
      entry_text: "Wrapped entry.",
      source_file: "journal.pdf",
    });
  });
});

describe("normalizeEntryRawContent", () => {
  it("parses JSON entry content", () => {
    expect(
      normalizeEntryRawContent(
        JSON.stringify({
          date: "2026-06-03",
          entry_text: "JSON entry.",
          source_file: "journal.pdf",
        }),
        "fallback.pdf",
      ),
    ).toEqual({
      date: "2026-06-03",
      entry_text: "JSON entry.",
      source_file: "journal.pdf",
    });
  });

  it("treats non-JSON S3 content as plain text", () => {
    expect(normalizeEntryRawContent("ENTRY\n\nplain text", "scan.png")).toEqual({
      date: null,
      entry_text: "ENTRY\n\nplain text",
      source_file: "scan.png",
    });
  });

  it("returns null for empty content", () => {
    expect(normalizeEntryRawContent("   ", "scan.png")).toBeNull();
  });
});

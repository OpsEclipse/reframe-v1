import { describe, expect, it } from "vitest";
import { groupArchiveEntries } from "@/lib/entries/archive";

describe("groupArchiveEntries", () => {
  it("groups dated entries by year and sorts newest first", () => {
    expect(
      groupArchiveEntries([
        {
          entry_id: "old",
          s3_key: "entries/user/old.json",
          source_file: "journal.pdf",
          entry_date: "2025-12-12",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          entry_id: "new",
          s3_key: "entries/user/new.json",
          source_file: "journal.pdf",
          entry_date: "2026-06-03",
          created_at: "2026-06-04T00:00:00.000Z",
          updated_at: "2026-06-04T00:00:00.000Z",
        },
        {
          entry_id: "mid",
          s3_key: "entries/user/mid.json",
          source_file: "journal.pdf",
          entry_date: "2026-05-28",
          created_at: "2026-06-02T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        key: "2026",
        label: "2026",
        entries: [
          expect.objectContaining({ entry_id: "new", label: "Jun 03" }),
          expect.objectContaining({ entry_id: "mid", label: "May 28" }),
        ],
      },
      {
        key: "2025",
        label: "2025",
        entries: [expect.objectContaining({ entry_id: "old", label: "Dec 12" })],
      },
    ]);
  });

  it("puts undated entries after dated groups with numbered labels", () => {
    expect(
      groupArchiveEntries([
        {
          entry_id: "dated",
          s3_key: "entries/user/dated.json",
          source_file: null,
          entry_date: "2026-06-03",
          created_at: "2026-06-03T00:00:00.000Z",
          updated_at: "2026-06-03T00:00:00.000Z",
        },
        {
          entry_id: "undated-new",
          s3_key: "entries/user/u1.json",
          source_file: null,
          entry_date: null,
          created_at: "2026-06-04T00:00:00.000Z",
          updated_at: "2026-06-04T00:00:00.000Z",
        },
        {
          entry_id: "undated-old",
          s3_key: "entries/user/u2.json",
          source_file: null,
          entry_date: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: "2026",
        entries: [expect.objectContaining({ entry_id: "dated", label: "Jun 03" })],
      }),
      {
        key: "undated",
        label: "Undated",
        entries: [
          expect.objectContaining({ entry_id: "undated-new", label: "Undated entry" }),
          expect.objectContaining({ entry_id: "undated-old", label: "Undated entry 2" }),
        ],
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { EntryReferenceWithContent } from "@/lib/entries/content";
import {
  buildReflectionInput,
  buildReflectionInstructions,
  buildReflectionResponseSchema,
  MAX_PRIMARY_ENTRY_CHARS,
  MAX_RELATED_ENTRY_CHARS,
} from "@/lib/reflections/prompt";

function buildEntry(
  entryId: string,
  text: string,
  entryDate: string | null = "2026-06-03",
): EntryReferenceWithContent {
  return {
    entry_id: entryId,
    s3_key: `entries/user/${entryId}.json`,
    source_file: "journal.json",
    entry_date: entryDate,
    pinecone_vector_id: `entry:${entryId}`,
    content: {
      date: entryDate,
      entry_text: text,
      source_file: "journal.json",
    },
  };
}

describe("buildReflectionResponseSchema", () => {
  it("limits entry references to provided entry ids", () => {
    const schema = buildReflectionResponseSchema(["entry-a", "entry-b"]);

    expect(schema.properties.primary_entry_id).toEqual({
      type: "string",
      enum: ["entry-a", "entry-b"],
    });

    const entryReferenceVariant = schema.properties.blocks.items.anyOf[1];
    expect(entryReferenceVariant.properties.entry_id).toEqual({
      type: "string",
      enum: ["entry-a", "entry-b"],
    });
  });

  it("includes explicit type keys on block discriminators", () => {
    const schema = buildReflectionResponseSchema(["entry-a"]);

    const paragraphVariant = schema.properties.blocks.items.anyOf[0];
    const entryReferenceVariant = schema.properties.blocks.items.anyOf[1];

    expect(paragraphVariant.properties.type).toEqual({
      type: "string",
      const: "paragraph",
    });
    expect(entryReferenceVariant.properties.type).toEqual({
      type: "string",
      const: "entry_reference",
    });
  });
});

describe("buildReflectionInstructions", () => {
  it("asks for an open-ended writing prompt", () => {
    const instructions = buildReflectionInstructions();

    expect(instructions).toContain("open-ended writing prompt");
    expect(instructions).toContain("February 2025");
    expect(instructions).toContain("Avoid narrow yes/no questions");
  });
});

describe("buildReflectionInput", () => {
  it("truncates oversized primary and related entries", () => {
    const input = buildReflectionInput({
      primaryEntry: buildEntry("entry-a", "a".repeat(MAX_PRIMARY_ENTRY_CHARS + 20)),
      relatedEntries: [
        buildEntry("entry-b", "b".repeat(MAX_RELATED_ENTRY_CHARS + 10)),
      ],
    });

    expect(input).toContain(`[truncated 20 characters]`);
    expect(input).toContain(`[truncated 10 characters]`);
  });
});

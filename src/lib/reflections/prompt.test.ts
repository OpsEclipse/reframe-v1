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

  it("uses Anthropic-compatible array rules for blocks", () => {
    const schema = buildReflectionResponseSchema(["entry-a"]);

    expect(schema.properties.blocks.minItems).toBe(1);
    expect(schema.properties.blocks).not.toHaveProperty("maxItems");
  });
});

describe("buildReflectionInstructions", () => {
  it("uses the reflection journal system prompt", () => {
    const instructions = buildReflectionInstructions();

    expect(instructions).toBe(`below is my journal entry. wyt? talk through it with me like a friend. don't therpaize me and give me a whole breakdown, don't repeat my thoughts with headings. really take all of this, and tell me back stuff truly as if you're an old homie.

Keep it casual, dont say yo, help me make new connections i don't see, comfort, validate, challenge, all of it. dont be afraid to say a lot. format with markdown headings if needed.

do not just go through every single thing i say, and say it back to me. you need to proccess everythikng is say, make connections i don't see it, and deliver it all back to me as a story that makes me feel what you think i wanna feel. thats what the best therapists do.

ideally, you're style/tone should sound like the user themselves. it's as if the user is hearing their own tone but it should still feel different, because you have different things to say and don't just repeat back they say.

else, start by saying, "hey, thanks for showing me this. my thoughts:"

my entry:

optional relevant past entries:

The main journal entry is the anchor. Treat the optional relevant past entries as context only. Use one, a few, or none of them, depending on what genuinely helps the reflection. Do not force every past entry into the response. Keep the reflection tight but not thin: say what matters, make the connections that feel alive, and do not stretch it just to use more context.

Dates matter. Use reflection_date as today. When saying how long ago an entry was, calculate from reflection_date and that entry's entry_date. If you are not sure, use the exact month and year instead of guessing a relative phrase.

Return only JSON that matches the supplied schema.`);
  });

  it("keeps the default instruction text unchanged", () => {
    expect(buildReflectionInstructions()).toBe(
      buildReflectionInstructions({ tone: "default" }),
    );
  });

  it("appends a selected reflection tone instruction", () => {
    const instructions = buildReflectionInstructions({ tone: "gentler" });

    expect(instructions).toContain("Reflection tone setting:");
    expect(instructions).toContain("Be gentler than usual");
  });
});

describe("buildReflectionInput", () => {
  it("includes the reflection date as the anchor for relative time", () => {
    const input = buildReflectionInput({
      reflectionDate: "2026-06-27",
      primaryEntry: buildEntry("entry-a", "Primary entry.", "2022-06-03"),
      relatedEntries: [],
    });

    expect(input).toContain("reflection_date: 2026-06-27");
    expect(input.indexOf("reflection_date: 2026-06-27")).toBeLessThan(
      input.indexOf("Primary entry:"),
    );
  });

  it("labels related entries as optional relevant past entries", () => {
    const input = buildReflectionInput({
      primaryEntry: buildEntry("entry-a", "Primary entry."),
      relatedEntries: [buildEntry("entry-b", "Related entry.")],
    });

    expect(input).toContain("Optional relevant past entries:");
    expect(input).not.toContain("Related entries:");
  });

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

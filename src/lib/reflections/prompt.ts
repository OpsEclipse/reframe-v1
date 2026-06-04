import type { EntryReferenceWithContent } from "@/lib/entries/content";

export const MAX_PRIMARY_ENTRY_CHARS = 6000;
export const MAX_RELATED_ENTRY_CHARS = 2500;

export function buildReflectionResponseSchema(allowedEntryIds: string[]) {
  const entryIdSchema =
    allowedEntryIds.length > 0
      ? { type: "string", enum: allowedEntryIds }
      : { type: "string", minLength: 1 };

  return {
    type: "object",
    additionalProperties: false,
    required: ["primary_entry_id", "blocks", "writing_prompt"],
    properties: {
      primary_entry_id: entryIdSchema,
      blocks: {
        type: "array",
        minItems: 3,
        maxItems: 10,
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "text"],
              properties: {
                type: {
                  type: "string",
                  const: "paragraph",
                },
                text: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "entry_id", "quote", "text"],
              properties: {
                type: {
                  type: "string",
                  const: "entry_reference",
                },
                entry_id: entryIdSchema,
                quote: {
                  type: "string",
                  minLength: 1,
                },
                text: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
          ],
        },
      },
      writing_prompt: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: {
          text: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
  } as const;
}

export function buildReflectionInstructions(): string {
  return [
    "Talk like an old friend.",
    "Do not sound clinical.",
    "Do not therapize the user.",
    "Do not summarize every point.",
    "Do not mirror the user's thoughts with headings.",
    "Make connections the user may not see.",
    "Comfort, validate, and challenge.",
    "Be casual, but do not say yo.",
    "Sound close to the user's tone, without copying it.",
    "Use entry references only as entry_reference blocks.",
    "Let the narrative decide where entry_reference blocks appear.",
    "If an entry was excerpted for length, only quote from the visible excerpt.",
    "End with exactly one open-ended writing prompt.",
    "The writing prompt should feel spacious, personal, and specific to the reflection.",
    "Avoid narrow yes/no questions or generic advice prompts.",
    "A good writing prompt can sound like: If the version of you from February 2025 could see today's entries, what would he admit he was wrong about?",
    "Return only JSON that matches the supplied schema.",
  ].join("\n");
}

function truncateEntryText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const omittedCharCount = text.length - maxChars;
  return `${text.slice(0, maxChars).trimEnd()}\n\n[truncated ${omittedCharCount} characters]`;
}

function formatEntry(entry: EntryReferenceWithContent, maxChars: number): string {
  return [
    `entry_id: ${entry.entry_id}`,
    `entry_date: ${entry.entry_date ?? ""}`,
    "entry_text:",
    truncateEntryText(entry.content.entry_text, maxChars),
  ].join("\n");
}

export function buildReflectionInput({
  primaryEntry,
  relatedEntries,
}: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
}): string {
  const relatedEntryText =
    relatedEntries.length > 0
      ? relatedEntries
          .map((entry) => formatEntry(entry, MAX_RELATED_ENTRY_CHARS))
          .join("\n\n")
      : "No related entries were found.";

  return [
    "Primary entry:",
    formatEntry(primaryEntry, MAX_PRIMARY_ENTRY_CHARS),
    "",
    "Related entries:",
    relatedEntryText,
  ].join("\n");
}

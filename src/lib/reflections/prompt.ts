import type { EntryReferenceWithContent } from "@/lib/entries/content";
import {
  getReflectionToneInstruction,
  type ReflectionTone,
} from "@/lib/reflections/tone";

export const MAX_PRIMARY_ENTRY_CHARS = 6000;
export const MAX_RELATED_ENTRY_CHARS = 2500;

export function buildReflectionDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

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
        minItems: 1,
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

export function buildReflectionInstructions({
  tone = "default",
}: {
  tone?: ReflectionTone;
} = {}): string {
  const baseInstructions = `below is my journal entry. wyt? talk through it with me like a friend. don't therpaize me and give me a whole breakdown, don't repeat my thoughts with headings. really take all of this, and tell me back stuff truly as if you're an old homie.

Keep it casual, dont say yo, help me make new connections i don't see, comfort, validate, challenge, all of it. dont be afraid to say a lot. format with markdown headings if needed.

do not just go through every single thing i say, and say it back to me. you need to proccess everythikng is say, make connections i don't see it, and deliver it all back to me as a story that makes me feel what you think i wanna feel. thats what the best therapists do.

ideally, you're style/tone should sound like the user themselves. it's as if the user is hearing their own tone but it should still feel different, because you have different things to say and don't just repeat back they say.

else, start by saying, "hey, thanks for showing me this. my thoughts:"

my entry:

optional relevant past entries:

The main journal entry is the anchor. Treat the optional relevant past entries as context only. Use one, a few, or none of them, depending on what genuinely helps the reflection. Do not force every past entry into the response. Keep the reflection tight but not thin: say what matters, make the connections that feel alive, and do not stretch it just to use more context.

Dates matter. Use reflection_date as today. When saying how long ago an entry was, calculate from reflection_date and that entry's entry_date. If you are not sure, use the exact month and year instead of guessing a relative phrase.

Return only JSON that matches the supplied schema.`;
  const toneInstruction = getReflectionToneInstruction(tone);

  return toneInstruction
    ? `${baseInstructions}\n\n${toneInstruction}`
    : baseInstructions;
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
  reflectionDate = buildReflectionDate(),
  primaryEntry,
  relatedEntries,
}: {
  reflectionDate?: string;
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
    `reflection_date: ${reflectionDate}`,
    "",
    "Primary entry:",
    formatEntry(primaryEntry, MAX_PRIMARY_ENTRY_CHARS),
    "",
    "Optional relevant past entries:",
    relatedEntryText,
  ].join("\n");
}

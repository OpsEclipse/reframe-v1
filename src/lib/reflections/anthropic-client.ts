import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";

import type { EntryReferenceWithContent } from "@/lib/entries/content";
import {
  buildReflectionInput,
  buildReflectionInstructions,
  buildReflectionResponseSchema,
} from "@/lib/reflections/prompt";
import {
  parseReflectionResponse,
  type ReflectionResponse,
} from "@/lib/reflections/types";

const DEFAULT_REFLECTION_MODEL = "claude-sonnet-4-6";
const MAX_REFLECTION_OUTPUT_TOKENS = 4096;

let anthropicClient: Anthropic | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });
  }

  return anthropicClient;
}

export function getReflectionModel(): string {
  return process.env.ANTHROPIC_REFLECTION_MODEL || DEFAULT_REFLECTION_MODEL;
}

function extractTextContent(response: Message): string | null {
  for (const block of response.content) {
    if (block.type === "text" && block.text.trim()) {
      return block.text;
    }
  }

  return null;
}

export async function generateReflectionResponse(params: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
}): Promise<ReflectionResponse> {
  const allowedEntryIds = new Set([
    params.primaryEntry.entry_id,
    ...params.relatedEntries.map((entry) => entry.entry_id),
  ]);
  const entryTextsById = new Map([
    [params.primaryEntry.entry_id, params.primaryEntry.content.entry_text],
    ...params.relatedEntries.map(
      (entry) => [entry.entry_id, entry.content.entry_text] as const,
    ),
  ]);

  const response = await getAnthropicClient().messages.create({
    model: getReflectionModel(),
    max_tokens: MAX_REFLECTION_OUTPUT_TOKENS,
    stream: false,
    system: buildReflectionInstructions(),
    messages: [
      {
        role: "user",
        content: buildReflectionInput(params),
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: buildReflectionResponseSchema([...allowedEntryIds]) as Record<
          string,
          unknown
        >,
      },
    },
  });

  const raw = extractTextContent(response);
  if (!raw) {
    throw new Error("Anthropic did not return reflection JSON.");
  }

  return parseReflectionResponse(
    JSON.parse(raw) as unknown,
    allowedEntryIds,
    entryTextsById,
  );
}

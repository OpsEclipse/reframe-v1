import OpenAI from "openai";

import {
  parseReflectionResponse,
  type ReflectionResponse,
} from "@/lib/reflections/types";
import {
  buildReflectionInput,
  buildReflectionInstructions,
  buildReflectionResponseSchema,
} from "@/lib/reflections/prompt";
import type { EntryReferenceWithContent } from "@/lib/entries/content";

let openAIClient: OpenAI | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
    });
  }

  return openAIClient;
}

export function getReflectionModel(): string {
  return process.env.OPENAI_REFLECTION_MODEL || "gpt-5.2";
}

export async function generateReflectionResponse(params: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
}): Promise<ReflectionResponse> {
  const allowedEntryIds = new Set([
    params.primaryEntry.entry_id,
    ...params.relatedEntries.map((entry) => entry.entry_id),
  ]);

  const response = await getOpenAIClient().responses.create({
    model: getReflectionModel(),
    instructions: buildReflectionInstructions(),
    input: buildReflectionInput(params),
    text: {
      format: {
        type: "json_schema",
        name: "reflect_response",
        strict: true,
        schema: buildReflectionResponseSchema([...allowedEntryIds]),
      },
    },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI did not return reflection JSON.");
  }

  return parseReflectionResponse(JSON.parse(raw) as unknown, allowedEntryIds);
}

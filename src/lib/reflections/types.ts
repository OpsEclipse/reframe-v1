export type ReflectionBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "entry_reference";
      entry_id: string;
      quote: string;
      text: string;
    };

export interface ReflectionResponse {
  primary_entry_id: string;
  blocks: ReflectionBlock[];
  writing_prompt: {
    text: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} must not be blank.`);
  }

  return trimmed;
}

function assertKnownEntryId(
  entryId: string,
  allowedEntryIds: ReadonlySet<string>,
  fieldName: string,
): void {
  if (!allowedEntryIds.has(entryId)) {
    throw new Error(`${fieldName} has unknown entry_id: ${entryId}.`);
  }
}

function parseReflectionBlock(
  value: unknown,
  allowedEntryIds: ReadonlySet<string>,
  index: number,
): ReflectionBlock {
  if (!isRecord(value)) {
    throw new Error(`blocks[${index}] must be an object.`);
  }

  const type = parseRequiredString(value.type, `blocks[${index}].type`);

  if (type === "paragraph") {
    return {
      type,
      text: parseRequiredString(value.text, `blocks[${index}].text`),
    };
  }

  if (type === "entry_reference") {
    const entryId = parseRequiredString(
      value.entry_id,
      `blocks[${index}].entry_id`,
    );
    assertKnownEntryId(entryId, allowedEntryIds, `blocks[${index}].entry_id`);

    return {
      type,
      entry_id: entryId,
      quote: parseRequiredString(value.quote, `blocks[${index}].quote`),
      text: parseRequiredString(value.text, `blocks[${index}].text`),
    };
  }

  throw new Error(`Unsupported reflection block type: ${type}.`);
}

export function parseReflectionResponse(
  value: unknown,
  allowedEntryIds: ReadonlySet<string>,
): ReflectionResponse {
  if (!isRecord(value)) {
    throw new Error("Reflection response must be an object.");
  }

  const primaryEntryId = parseRequiredString(
    value.primary_entry_id,
    "primary_entry_id",
  );
  assertKnownEntryId(primaryEntryId, allowedEntryIds, "primary_entry_id");

  if (!Array.isArray(value.blocks)) {
    throw new Error("blocks must be an array.");
  }

  const writingPrompt = value.writing_prompt;
  if (!isRecord(writingPrompt)) {
    throw new Error("writing_prompt must be an object.");
  }

  return {
    primary_entry_id: primaryEntryId,
    blocks: value.blocks.map((block, index) =>
      parseReflectionBlock(block, allowedEntryIds, index),
    ),
    writing_prompt: {
      text: parseRequiredString(writingPrompt.text, "writing_prompt.text"),
    },
  };
}

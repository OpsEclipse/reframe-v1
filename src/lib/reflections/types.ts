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

function normalizeQuoteText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function assertCopiedQuote(
  entryId: string,
  quote: string,
  entryTextsById: ReadonlyMap<string, string> | undefined,
  fieldName: string,
): void {
  if (!entryTextsById) return;

  const entryText = entryTextsById.get(entryId);
  if (!entryText) {
    throw new Error(`${fieldName} cannot be checked because entry text is missing.`);
  }

  if (!normalizeQuoteText(entryText).includes(normalizeQuoteText(quote))) {
    throw new Error(`${fieldName} quote must be copied from entry text.`);
  }
}

function parseReflectionBlock(
  value: unknown,
  allowedEntryIds: ReadonlySet<string>,
  entryTextsById: ReadonlyMap<string, string> | undefined,
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
    const quote = parseRequiredString(value.quote, `blocks[${index}].quote`);
    assertCopiedQuote(
      entryId,
      quote,
      entryTextsById,
      `blocks[${index}].quote`,
    );

    return {
      type,
      entry_id: entryId,
      quote,
      text: parseRequiredString(value.text, `blocks[${index}].text`),
    };
  }

  throw new Error(`Unsupported reflection block type: ${type}.`);
}

export function parseReflectionResponse(
  value: unknown,
  allowedEntryIds: ReadonlySet<string>,
  entryTextsById?: ReadonlyMap<string, string>,
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

  if (value.blocks.length < 3 || value.blocks.length > 10) {
    throw new Error("blocks must contain 3 to 10 items.");
  }

  const writingPrompt = value.writing_prompt;
  if (!isRecord(writingPrompt)) {
    throw new Error("writing_prompt must be an object.");
  }

  return {
    primary_entry_id: primaryEntryId,
    blocks: value.blocks.map((block, index) =>
      parseReflectionBlock(block, allowedEntryIds, entryTextsById, index),
    ),
    writing_prompt: {
      text: parseRequiredString(writingPrompt.text, "writing_prompt.text"),
    },
  };
}

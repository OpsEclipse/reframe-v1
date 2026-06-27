import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  Anthropic: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: clientMocks.Anthropic,
}));

const primaryEntry = {
  entry_id: "entry-primary",
  entry_date: "2026-06-05",
  s3_key: "entries/user-123/entry-primary.json",
  source_file: "journal.pdf",
  pinecone_vector_id: "entry:entry-primary",
  content: {
    date: "2026-06-05",
    entry_text: "I keep noticing the same pattern.",
    source_file: "journal.pdf",
  },
};

const relatedEntry = {
  entry_id: "entry-related",
  entry_date: "2026-05-31",
  s3_key: "entries/user-123/entry-related.json",
  source_file: "journal.pdf",
  pinecone_vector_id: "entry:entry-related",
  content: {
    date: "2026-05-31",
    entry_text: "Earlier version of the same pattern.",
    source_file: "journal.pdf",
  },
};

async function importAnthropicClient() {
  vi.resetModules();
  return import("@/lib/reflections/anthropic-client");
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "anthropic-key";
  delete process.env.ANTHROPIC_REFLECTION_MODEL;

  clientMocks.Anthropic.mockImplementation(function Anthropic() {
    return {
    messages: {
      create: clientMocks.create,
    },
    };
  });
  clientMocks.create.mockResolvedValue({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          primary_entry_id: "entry-primary",
          blocks: [
            { type: "paragraph", text: "You are circling something real." },
            {
              type: "entry_reference",
              entry_id: "entry-related",
              quote: "Earlier version of the same pattern.",
              text: "This earlier entry gives the pattern a longer shadow.",
            },
            { type: "paragraph", text: "That makes today's entry feel less isolated." },
          ],
          writing_prompt: {
            text: "What would change if you treated the pattern as information?",
          },
        }),
      },
    ],
  });
});

describe("generateReflectionResponse", () => {
  it("requests a Claude Sonnet JSON response", async () => {
    const { generateReflectionResponse } = await importAnthropicClient();

    const result = await generateReflectionResponse({
      primaryEntry,
      relatedEntries: [relatedEntry],
    });

    expect(clientMocks.Anthropic).toHaveBeenCalledWith({
      apiKey: "anthropic-key",
    });
    expect(clientMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: expect.stringContaining("Return only JSON"),
        messages: [
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("entry_id: entry-primary"),
          }),
        ],
        output_config: {
          format: expect.objectContaining({
            type: "json_schema",
            schema: expect.objectContaining({
              required: ["primary_entry_id", "blocks", "writing_prompt"],
            }),
          }),
        },
      }),
    );
    expect(result.primary_entry_id).toBe("entry-primary");
    expect(result.blocks).toHaveLength(3);
  });

  it("uses an env override for the Claude reflection model", async () => {
    process.env.ANTHROPIC_REFLECTION_MODEL = "claude-sonnet-custom";
    const { getReflectionModel } = await importAnthropicClient();

    expect(getReflectionModel()).toBe("claude-sonnet-custom");
  });

  it("throws when Claude does not return text JSON", async () => {
    clientMocks.create.mockResolvedValue({ content: [] });
    const { generateReflectionResponse } = await importAnthropicClient();

    await expect(
      generateReflectionResponse({
        primaryEntry,
        relatedEntries: [relatedEntry],
      }),
    ).rejects.toThrow("Anthropic did not return reflection JSON.");
  });
});

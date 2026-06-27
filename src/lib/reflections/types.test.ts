import { describe, expect, it } from "vitest";
import { parseReflectionResponse } from "@/lib/reflections/types";

describe("parseReflectionResponse", () => {
  it("preserves block order", () => {
    const parsed = parseReflectionResponse(
      {
        primary_entry_id: "entry-a",
        blocks: [
          { type: "paragraph", text: "First." },
          {
            type: "entry_reference",
            entry_id: "entry-b",
            quote: "I should be further ahead.",
            text: "Second.",
          },
          { type: "paragraph", text: "Third." },
        ],
        writing_prompt: {
          text: "What are you calling failure too early?",
        },
      },
      new Set(["entry-a", "entry-b"]),
      new Map([["entry-b", "I should be further ahead."]]),
    );

    expect(parsed.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "entry_reference",
      "paragraph",
    ]);
  });

  it("rejects entry reference quotes that are not copied from the entry text", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [
            { type: "paragraph", text: "First." },
            {
              type: "entry_reference",
              entry_id: "entry-b",
              quote: "This means you were afraid of change.",
              text: "This should live outside the quote.",
            },
            { type: "paragraph", text: "Third." },
          ],
          writing_prompt: {
            text: "Write from here.",
          },
        },
        new Set(["entry-a", "entry-b"]),
        new Map([["entry-b", "I should be further ahead."]]),
      ),
    ).toThrow("quote must be copied from entry text");
  });

  it("rejects unknown entry references", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [
            { type: "paragraph", text: "First." },
            {
              type: "entry_reference",
              entry_id: "entry-x",
              quote: "Not provided.",
              text: "This should fail.",
            },
            { type: "paragraph", text: "Third." },
          ],
          writing_prompt: {
            text: "Write from here.",
          },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("unknown entry_id");
  });

  it("rejects empty writing prompts", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [
            { type: "paragraph", text: "First." },
            { type: "paragraph", text: "Second." },
            { type: "paragraph", text: "Third." },
          ],
          writing_prompt: { text: "" },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("writing_prompt.text");
  });

  it("rejects responses with too few or too many blocks", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [{ type: "paragraph", text: "Too short." }],
          writing_prompt: { text: "Write from here." },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("blocks must contain 3 to 10 items");

    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: Array.from({ length: 11 }, () => ({
            type: "paragraph",
            text: "Too long.",
          })),
          writing_prompt: { text: "Write from here." },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("blocks must contain 3 to 10 items");
  });
});

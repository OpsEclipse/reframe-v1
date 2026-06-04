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
    );

    expect(parsed.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "entry_reference",
      "paragraph",
    ]);
  });

  it("rejects unknown entry references", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [
            {
              type: "entry_reference",
              entry_id: "entry-x",
              quote: "Not provided.",
              text: "This should fail.",
            },
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
          blocks: [{ type: "paragraph", text: "Fine." }],
          writing_prompt: { text: "" },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("writing_prompt.text");
  });
});

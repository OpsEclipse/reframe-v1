import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ReflectionAnalysisScreen", () => {
  it("does not combine entry quote text and reflection text in one timeline string", () => {
    const source = readFileSync(
      new URL("./ReflectionAnalysisScreen.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain('text={`"${block.quote}"\\n\\n${block.text}`}');
  });
});

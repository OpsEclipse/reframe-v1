import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ArchetypeAnalysisScreen", () => {
  const source = readFileSync(
    new URL("./ArchetypeAnalysisScreen.tsx", import.meta.url),
    "utf8",
  );

  it("renders from the mock archetype data module", () => {
    expect(source).toContain("MOCK_ARCHETYPES");
    expect(source).toContain("getInitialArchetypeId");
  });

  it("supports card selection and Enter-to-continue", () => {
    expect(source).toContain("setSelectedArchetypeId");
    expect(source).toContain("aria-pressed");
    expect(source).toContain("event.key === 'Enter'");
    expect(source).toContain("shouldIgnoreGlobalEnter");
    expect(source).toContain("closest");
    expect(source).toContain("onComplete");
  });

  it("renders the screen heading as a semantic h1", () => {
    expect(source).toContain("<motion.h1");
    expect(source).toContain("</motion.h1>");
  });

  it("keeps the Figma copy and selected archetype visible in code", () => {
    expect(source).toContain(
      "Based off your entries, you fall into the following user archetype",
    );
    expect(source).toContain("CONTINUE");
  });
});

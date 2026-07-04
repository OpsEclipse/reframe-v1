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

  it("uses distinct selected and muted text classes for archetype card tones", () => {
    expect(source).toContain("selectedText");
    expect(source).toContain("mutedText");
    expect(source).toContain('selectedText: "text-[#6bde7c]"');
    expect(source).toContain('selectedText: "text-[#bd7cff]"');
    expect(source).toContain("tone.selectedText");
    expect(source).toContain("tone.mutedText");
  });

  it("keeps the Figma copy and selected archetype visible in code", () => {
    expect(source).toContain(
      "Based off your entries, you fall into the following user archetype",
    );
    expect(source).toContain("CONTINUE");
  });

  it("uses a top-safe scroll layout for narrow screens", () => {
    expect(source).toContain(
      'className="size-full overflow-y-auto px-[24px] py-[32px] md:py-[56px]"',
    );
    expect(source).toContain(
      'className="flex min-h-full w-full flex-col items-center justify-start md:justify-center"',
    );
    expect(source).not.toContain(
      'className="flex size-full flex-col items-center justify-center overflow-y-auto px-[24px] py-[56px]"',
    );
  });

  it("keeps rich card content outside the interactive overlay", () => {
    expect(source).toContain(
      "aria-label={`Select ${archetype.name} archetype`}",
    );
    expect(source).toContain("pointer-events-none");
  });
});

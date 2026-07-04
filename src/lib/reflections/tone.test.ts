import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFLECTION_TONE,
  getReflectionToneInstruction,
  normalizeReflectionTone,
  REFLECTION_TONE_OPTIONS,
} from "@/lib/reflections/tone";

describe("reflection tone helpers", () => {
  it("normalizes unknown values to the default tone", () => {
    expect(normalizeReflectionTone("gentler")).toBe("gentler");
    expect(normalizeReflectionTone("loud")).toBe(DEFAULT_REFLECTION_TONE);
    expect(normalizeReflectionTone(null)).toBe(DEFAULT_REFLECTION_TONE);
  });

  it("exposes user-facing labels for every tone", () => {
    expect(REFLECTION_TONE_OPTIONS).toEqual([
      { value: "default", label: "Default" },
      { value: "gentler", label: "Gentler" },
      { value: "more_direct", label: "More direct" },
      { value: "more_practical", label: "More practical" },
      { value: "more_curious", label: "More curious" },
    ]);
  });

  it("returns no extra instruction for the default tone", () => {
    expect(getReflectionToneInstruction("default")).toBeNull();
  });

  it("returns a concrete instruction for each non-default tone", () => {
    expect(getReflectionToneInstruction("gentler")).toContain("reassuring");
    expect(getReflectionToneInstruction("more_direct")).toContain("direct");
    expect(getReflectionToneInstruction("more_practical")).toContain("practical");
    expect(getReflectionToneInstruction("more_curious")).toContain("curious");
  });
});

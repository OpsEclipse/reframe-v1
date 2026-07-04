import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARCHETYPE_ID,
  MOCK_ARCHETYPES,
  getInitialArchetypeId,
} from "./archetype-data";

describe("mock archetype data", () => {
  it("defines the three mocked archetypes from the Figma result screen", () => {
    expect(MOCK_ARCHETYPES.map((archetype) => archetype.name)).toEqual([
      "ANCHOR",
      "SEEKER",
      "CHALLENGER",
    ]);

    expect(MOCK_ARCHETYPES).toHaveLength(3);
    expect(MOCK_ARCHETYPES.every((archetype) => archetype.tags.length > 0)).toBe(
      true,
    );
  });

  it("starts with seeker selected and falls back to the first archetype", () => {
    expect(DEFAULT_ARCHETYPE_ID).toBe("seeker");
    expect(getInitialArchetypeId(MOCK_ARCHETYPES)).toBe("seeker");
    expect(
      getInitialArchetypeId([
        { ...MOCK_ARCHETYPES[0], selected: false },
        { ...MOCK_ARCHETYPES[1], selected: false },
      ]),
    ).toBe("anchor");
  });
});

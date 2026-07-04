export type ArchetypeTone = "green" | "orange" | "purple";

export interface Archetype {
  id: string;
  name: string;
  description: string;
  inspiredBy: string;
  tags: string[];
  tone: ArchetypeTone;
  selected: boolean;
}

export const DEFAULT_ARCHETYPE_ID = "seeker";

export const MOCK_ARCHETYPES: Archetype[] = [
  {
    id: "anchor",
    name: "ANCHOR",
    description:
      "Centers your reflections on responsibility, resilience, and purpose. Pulls out moments where you chose your response and built meaning under pressure.",
    inspiredBy: "Inspired by Friedrich Nietzsche",
    tags: ["SYMBOLIC", "INTERPRETIVE", "PATTERN-SEEKING"],
    tone: "green",
    selected: false,
  },
  {
    id: DEFAULT_ARCHETYPE_ID,
    name: "SEEKER",
    description:
      "Connects hidden patterns across your entries and surfaces recurring themes, inner conflicts, and identity shifts over time. Focused on meaning beneath the surface.",
    inspiredBy: "Inspired by Carl Jung",
    tags: ["SYMBOLIC", "INTERPRETIVE", "PATTERN-SEEKING"],
    tone: "orange",
    selected: true,
  },
  {
    id: "challenger",
    name: "CHALLENGER",
    description:
      "Challenges your self-stories and comfortable conclusions. Points out rationalizations, repeated excuses, and belief gaps. Designed to provoke new thinking, not comfort.",
    inspiredBy: "Inspired by Viktor Frankl",
    tags: ["SYMBOLIC", "INTERPRETIVE", "PATTERN-SEEKING"],
    tone: "purple",
    selected: false,
  },
];

export function getInitialArchetypeId(archetypes: Archetype[]): string {
  return (
    archetypes.find((archetype) => archetype.selected)?.id ??
    archetypes[0]?.id ??
    DEFAULT_ARCHETYPE_ID
  );
}

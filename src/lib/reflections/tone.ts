export const REFLECTION_TONES = [
  "default",
  "gentler",
  "more_direct",
  "more_practical",
  "more_curious",
] as const;

export type ReflectionTone = (typeof REFLECTION_TONES)[number];

export const DEFAULT_REFLECTION_TONE: ReflectionTone = "default";

export const REFLECTION_TONE_OPTIONS: Array<{
  value: ReflectionTone;
  label: string;
}> = [
  { value: "default", label: "Default" },
  { value: "gentler", label: "Gentler" },
  { value: "more_direct", label: "More direct" },
  { value: "more_practical", label: "More practical" },
  { value: "more_curious", label: "More curious" },
];

const REFLECTION_TONE_INSTRUCTIONS: Record<
  Exclude<ReflectionTone, "default">,
  string
> = {
  gentler:
    "Reflection tone setting: Be gentler than usual. Keep the old-friend voice, but soften challenges, sound more reassuring, and avoid sharp phrasing.",
  more_direct:
    "Reflection tone setting: Be more direct than usual. Keep the care and warmth, but say the main point clearly with less cushioning.",
  more_practical:
    "Reflection tone setting: Be more practical than usual. Keep the reflection personal, but connect insights to concrete next steps the user can actually try.",
  more_curious:
    "Reflection tone setting: Be more curious than usual. Explore possibilities, ask open questions, and leave more room for the user to discover what feels true.",
};

export function normalizeReflectionTone(value: unknown): ReflectionTone {
  return typeof value === "string" &&
    REFLECTION_TONES.includes(value as ReflectionTone)
    ? (value as ReflectionTone)
    : DEFAULT_REFLECTION_TONE;
}

export function getReflectionToneInstruction(
  tone: ReflectionTone,
): string | null {
  if (tone === "default") {
    return null;
  }

  return REFLECTION_TONE_INSTRUCTIONS[tone];
}

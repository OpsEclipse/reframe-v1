# Reflection Tone Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localStorage-backed reflection tone setting that changes future generated reflections.

**Architecture:** Add one shared tone module for allowed values, labels, validation, and prompt instructions. Pass the selected tone from `App.tsx` to the session API, then through session creation to Claude prompt generation. Keep `Default` behavior unchanged.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Anthropic SDK.

---

## File Structure

- Create: `src/lib/reflections/tone.ts`
  - Owns tone values, labels, validation, and tone prompt instructions.
- Create: `src/lib/reflections/tone.test.ts`
  - Covers value normalization and instruction lookup.
- Modify: `src/lib/reflections/prompt.ts`
  - Accepts optional tone and appends tone instruction.
- Modify: `src/lib/reflections/prompt.test.ts`
  - Covers default prompt stability and tone instructions.
- Modify: `src/lib/reflections/anthropic-client.ts`
  - Accepts optional tone and passes it to prompt building.
- Modify: `src/lib/reflections/anthropic-client.test.ts`
  - Verifies the system prompt includes selected tone guidance.
- Modify: `src/lib/reflections/session.ts`
  - Accepts optional tone and passes it to reflection generation.
- Create: `src/app/api/reflections/session/route.test.ts`
  - Tests valid, missing, invalid, and malformed tone request bodies.
- Modify: `src/app/api/reflections/session/route.ts`
  - Parses JSON request body and passes normalized tone to session creation.
- Modify: `src/app/App.tsx`
  - Reads/writes tone from `localStorage` and sends it to the API.
- Modify: `src/app/components/SettingsMenu.tsx`
  - Adds the reflection tone picker.

---

### Task 1: Shared Tone Module

**Files:**
- Create: `src/lib/reflections/tone.test.ts`
- Create: `src/lib/reflections/tone.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/reflections/tone.test.ts`

Expected: FAIL because `@/lib/reflections/tone` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
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
    "Reflection tone setting: Be gentler than usual. Keep the old-friend voice, but soften challenges, add more reassurance, and avoid sharp phrasing.",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/reflections/tone.test.ts`

Expected: PASS.

---

### Task 2: Prompt And Anthropic Tone Path

**Files:**
- Modify: `src/lib/reflections/prompt.test.ts`
- Modify: `src/lib/reflections/prompt.ts`
- Modify: `src/lib/reflections/anthropic-client.test.ts`
- Modify: `src/lib/reflections/anthropic-client.ts`

- [ ] **Step 1: Write failing prompt tests**

Add tests:

```ts
it("keeps the default instruction text unchanged", () => {
  expect(buildReflectionInstructions()).toBe(buildReflectionInstructions({
    tone: "default",
  }));
});

it("appends a selected reflection tone instruction", () => {
  const instructions = buildReflectionInstructions({ tone: "gentler" });

  expect(instructions).toContain("Reflection tone setting:");
  expect(instructions).toContain("Be gentler than usual");
});
```

- [ ] **Step 2: Run prompt tests to verify they fail**

Run: `npm test -- src/lib/reflections/prompt.test.ts`

Expected: FAIL because `buildReflectionInstructions` does not accept a tone option yet.

- [ ] **Step 3: Implement prompt tone support**

Update `buildReflectionInstructions`:

```ts
import {
  getReflectionToneInstruction,
  type ReflectionTone,
} from "@/lib/reflections/tone";

export function buildReflectionInstructions({
  tone = "default",
}: {
  tone?: ReflectionTone;
} = {}): string {
  const baseInstructions = `existing prompt text`;
  const toneInstruction = getReflectionToneInstruction(tone);

  return toneInstruction
    ? `${baseInstructions}\n\n${toneInstruction}`
    : baseInstructions;
}
```

Keep the existing prompt text exactly where `existing prompt text` appears above.

- [ ] **Step 4: Run prompt tests to verify they pass**

Run: `npm test -- src/lib/reflections/prompt.test.ts src/lib/reflections/tone.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing Anthropic test**

Add this test in `generateReflectionResponse`:

```ts
it("sends selected tone guidance in the system prompt", async () => {
  const { generateReflectionResponse } = await importAnthropicClient();

  await generateReflectionResponse({
    primaryEntry,
    relatedEntries: [relatedEntry],
    tone: "more_practical",
  });

  expect(clientMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      system: expect.stringContaining("Be more practical than usual"),
    }),
  );
});
```

- [ ] **Step 6: Run Anthropic test to verify it fails**

Run: `npm test -- src/lib/reflections/anthropic-client.test.ts`

Expected: FAIL because `generateReflectionResponse` does not accept or pass `tone` yet.

- [ ] **Step 7: Implement Anthropic tone support**

Update the params type and system call:

```ts
import type { ReflectionTone } from "@/lib/reflections/tone";

export async function generateReflectionResponse(params: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
  tone?: ReflectionTone;
}): Promise<ReflectionResponse> {
  // existing setup
  const response = await getAnthropicClient().messages.create({
    // existing fields
    system: buildReflectionInstructions({ tone: params.tone }),
    // existing fields
  });
}
```

- [ ] **Step 8: Run reflection prompt/client tests**

Run: `npm test -- src/lib/reflections/tone.test.ts src/lib/reflections/prompt.test.ts src/lib/reflections/anthropic-client.test.ts`

Expected: PASS.

---

### Task 3: Session API Tone Parsing

**Files:**
- Create: `src/app/api/reflections/session/route.test.ts`
- Modify: `src/app/api/reflections/session/route.ts`
- Modify: `src/lib/reflections/session.ts`

- [ ] **Step 1: Write failing route tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  createReflectionSession: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

vi.mock("@/lib/reflections/session", () => ({
  createReflectionSession: mocks.createReflectionSession,
}));

function buildSession() {
  return {
    sessionId: "session-1",
    primaryEntry: {
      entry_id: "entry-a",
      entry_date: "2026-06-03",
      content: { entry_text: "Entry text." },
    },
    relatedEntries: [],
    reflection: {
      primary_entry_id: "entry-a",
      blocks: [{ type: "paragraph", text: "Reflection." }],
      writing_prompt: { text: "What feels true?" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIngestionActor.mockResolvedValue({
    user: { id: "user-123" },
    clientId: "client-456",
    supabase: { from: vi.fn() },
  });
  mocks.createReflectionSession.mockResolvedValue(buildSession());
});

describe("POST /api/reflections/session", () => {
  it("passes a valid tone into reflection session creation", async () => {
    const { POST } = await import("@/app/api/reflections/session/route");

    const response = await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: JSON.stringify({ tone: "more_curious" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createReflectionSession).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "more_curious" }),
    );
  });

  it("defaults missing, invalid, and malformed tone bodies", async () => {
    const { POST } = await import("@/app/api/reflections/session/route");

    await POST(new Request("http://test.local/api/reflections/session", { method: "POST" }));
    await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: JSON.stringify({ tone: "loud" }),
      }),
    );
    await POST(
      new Request("http://test.local/api/reflections/session", {
        method: "POST",
        body: "{",
      }),
    );

    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tone: "default" }),
    );
    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tone: "default" }),
    );
    expect(mocks.createReflectionSession).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ tone: "default" }),
    );
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test -- src/app/api/reflections/session/route.test.ts`

Expected: FAIL because `POST` does not accept a request body and does not pass `tone`.

- [ ] **Step 3: Implement route parsing and session tone param**

In `route.ts`, accept `request: Request`, safely read JSON, normalize `body?.tone`, and pass `tone`.

In `session.ts`, add `tone?: ReflectionTone` to `createReflectionSession` params and pass it to `generateReflectionResponse`.

- [ ] **Step 4: Run route and reflection tests**

Run: `npm test -- src/app/api/reflections/session/route.test.ts src/lib/reflections/session.test.ts src/lib/reflections/anthropic-client.test.ts`

Expected: PASS.

---

### Task 4: LocalStorage Settings UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/components/SettingsMenu.tsx`

- [ ] **Step 1: Implement client state and API body**

In `App.tsx`, import tone helpers, add `reflectionTone` state, read from `localStorage` in `useEffect`, write changes in a handler, and send the tone in `startReflectionSession`.

Use this key:

```ts
const REFLECTION_TONE_STORAGE_KEY = "reframe.reflectionTone";
```

The fetch body should become:

```ts
body: JSON.stringify({ tone: reflectionTone }),
```

- [ ] **Step 2: Pass the settings control through the page**

Move `SettingsMenu` into `App.tsx` or pass tone props from `App.tsx` to a positioned settings component. Keep the visible position unchanged.

Use this prop shape:

```ts
type SettingsMenuProps = {
  email: string | null;
  reflectionTone: ReflectionTone;
  onReflectionToneChange: (tone: ReflectionTone) => void;
};
```

- [ ] **Step 3: Add the picker UI**

In `SettingsMenu.tsx`, render the tone options above Sign out:

```tsx
<div className="mb-2 border-b border-white/10 px-2 pb-2">
  <p className="mb-2 font-roboto-mono text-[10px] font-medium uppercase text-white/35">
    Reflection tone
  </p>
  <div className="grid gap-1">
    {REFLECTION_TONE_OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={reflectionTone === option.value}
        onClick={() => onReflectionToneChange(option.value)}
        className={cn(
          "flex w-full items-center justify-between rounded-[4px] px-2 py-2 text-left font-manrope text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
          reflectionTone === option.value
            ? "bg-white/15 text-white"
            : "text-white/65 hover:bg-white/10 hover:text-white",
        )}
      >
        <span>{option.label}</span>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Run type, lint, and tests**

Run:

```bash
npm test -- src/lib/reflections/tone.test.ts src/lib/reflections/prompt.test.ts src/lib/reflections/anthropic-client.test.ts src/app/api/reflections/session/route.test.ts
npm run lint
npm run build
```

Expected: all commands exit 0.

---

## Self-Review

Spec coverage:

- LocalStorage setting: Task 4.
- Settings picker: Task 4.
- Tone API body: Tasks 3 and 4.
- Prompt steering: Tasks 1 and 2.
- Default fallback: Tasks 1 and 3.
- Tests: Tasks 1, 2, and 3.

Placeholder scan: no `TBD`, `TODO`, or unspecified test steps remain.

Type consistency: all implementation steps use `ReflectionTone`, `default`, `gentler`, `more_direct`, `more_practical`, and `more_curious`.

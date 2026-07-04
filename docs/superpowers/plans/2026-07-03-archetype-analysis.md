# Archetype Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mocked archetype analysis result screen to the Reflect flow, matching Figma node `70:648`.

**Architecture:** Keep mocked archetype data in a small data module. Add a focused `ArchetypeAnalysisScreen` React component that owns selected-card state. Wire `src/app/App.tsx` so the flow becomes existing reflection analysis -> archetype analysis -> reflection prompt.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Motion, Vitest in Node mode.

---

## File Structure

- Create `src/app/components/archetype-data.ts`
  - Owns the mock archetype data, the `Archetype` type, `DEFAULT_ARCHETYPE_ID`, and `getInitialArchetypeId`.
- Create `src/app/components/archetype-data.test.ts`
  - Verifies the mocked archetype contract without rendering React.
- Create `src/app/components/ArchetypeAnalysisScreen.tsx`
  - Renders the Figma-matched archetype result screen.
  - Owns local selected-card state.
  - Calls `onComplete` on Enter or continue button click.
- Create `src/app/components/ArchetypeAnalysisScreen.test.ts`
  - Uses the repo's source-read test style to verify the component is wired to the data module and includes key interaction hooks.
- Create `src/app/App.test.ts`
  - Uses source-read tests to verify the Reflect flow includes the new `archetypeAnalysis` step.
- Modify `src/app/App.tsx`
  - Import and render the new screen.
  - Add the `archetypeAnalysis` screen state.
  - Route existing analysis completion to archetype analysis.
  - Route archetype completion to the reflection prompt.

## Task 1: Mock Archetype Data

**Files:**
- Create: `src/app/components/archetype-data.test.ts`
- Create: `src/app/components/archetype-data.ts`

- [ ] **Step 1: Write the failing data test**

Create `src/app/components/archetype-data.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the data test to verify it fails**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts
```

Expected: FAIL with an import error for `./archetype-data`.

- [ ] **Step 3: Implement the mock data module**

Create `src/app/components/archetype-data.ts`:

```ts
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
```

- [ ] **Step 4: Run the data test to verify it passes**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/app/components/archetype-data.ts src/app/components/archetype-data.test.ts
git commit -m "feat: add mock archetype data"
```

## Task 2: Archetype Analysis Screen

**Files:**
- Create: `src/app/components/ArchetypeAnalysisScreen.test.ts`
- Create: `src/app/components/ArchetypeAnalysisScreen.tsx`

- [ ] **Step 1: Write the failing component source test**

Create `src/app/components/ArchetypeAnalysisScreen.test.ts`:

```ts
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
    expect(source).toContain("onComplete");
  });

  it("keeps the Figma copy and selected archetype visible in code", () => {
    expect(source).toContain(
      "Based off your entries, you fall into the following user archetype",
    );
    expect(source).toContain("CONTINUE");
  });
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
npm test -- src/app/components/ArchetypeAnalysisScreen.test.ts
```

Expected: FAIL with a file-read error because `ArchetypeAnalysisScreen.tsx` does not exist.

- [ ] **Step 3: Implement `ArchetypeAnalysisScreen`**

Create `src/app/components/ArchetypeAnalysisScreen.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { EnterActionButton } from "./shared/screen-primitives";
import {
  MOCK_ARCHETYPES,
  getInitialArchetypeId,
  type Archetype,
  type ArchetypeTone,
} from "./archetype-data";
import { cn } from "./ui/utils";

interface ArchetypeAnalysisScreenProps {
  onComplete: () => void;
}

const toneClasses: Record<
  ArchetypeTone,
  {
    text: string;
    border: string;
    selectedRing: string;
    mutedBorder: string;
  }
> = {
  green: {
    text: "text-[rgba(107,222,124,0.42)]",
    border: "border-[rgba(107,222,124,0.42)]",
    selectedRing: "border-[rgba(107,222,124,0.22)]",
    mutedBorder: "border-[rgba(107,222,124,0.32)]",
  },
  orange: {
    text: "text-[#ff845f]",
    border: "border-[#ff845f]",
    selectedRing: "border-[rgba(255,132,95,0.22)]",
    mutedBorder: "border-[rgba(255,132,95,0.32)]",
  },
  purple: {
    text: "text-[rgba(189,124,255,0.42)]",
    border: "border-[rgba(189,124,255,0.42)]",
    selectedRing: "border-[rgba(189,124,255,0.22)]",
    mutedBorder: "border-[rgba(189,124,255,0.32)]",
  },
};

function ArchetypeCard({
  archetype,
  isSelected,
  onSelect,
}: {
  archetype: Archetype;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tone = toneClasses[archetype.tone];

  return (
    <motion.div
      className={cn(
        "relative flex w-full max-w-[314px] shrink-0",
        isSelected && "border-[5px] border-solid p-0",
        isSelected && tone.selectedRing,
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className={cn(
          "flex h-[420px] w-full flex-col items-start justify-between border border-solid p-[24px] text-left transition-[opacity,transform,background-color] duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 md:h-[588px] md:p-[29px]",
          isSelected
            ? cn(tone.border, tone.text, "opacity-100")
            : cn(tone.mutedBorder, tone.text, "opacity-50 hover:opacity-70"),
        )}
      >
        <div className="flex flex-col items-start gap-[24px] md:gap-[29px]">
          <h2 className="font-manrope text-[24px] font-semibold leading-[normal] tracking-[0]">
            {archetype.name}
          </h2>
          <p className="font-manrope text-[18px] font-medium leading-[1.18] tracking-[0] md:text-[19.6px]">
            {archetype.description}
          </p>
          <p className="font-manrope text-[14px] font-medium leading-[normal] md:text-[14.7px]">
            {archetype.inspiredBy}
          </p>
        </div>

        <div className="flex max-w-full flex-wrap gap-[3px]">
          {archetype.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "rounded-[2.5px] border border-solid px-[5px] py-[4px] font-manrope text-[12px] font-semibold leading-[normal] tracking-[0] md:text-[14.7px]",
                isSelected ? tone.border : tone.mutedBorder,
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      </button>
    </motion.div>
  );
}

export function ArchetypeAnalysisScreen({
  onComplete,
}: ArchetypeAnalysisScreenProps) {
  const archetypes = useMemo(() => MOCK_ARCHETYPES, []);
  const [selectedArchetypeId, setSelectedArchetypeId] = useState(() =>
    getInitialArchetypeId(archetypes),
  );

  useEffect(() => {
    if (!archetypes.some((archetype) => archetype.id === selectedArchetypeId)) {
      setSelectedArchetypeId(getInitialArchetypeId(archetypes));
    }
  }, [archetypes, selectedArchetypeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") onComplete();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onComplete]);

  return (
    <div className="flex size-full flex-col items-center justify-center overflow-y-auto px-[24px] py-[56px]">
      <div className="flex w-full max-w-[908px] flex-col items-center gap-[32px] md:gap-[39px]">
        <motion.p
          className="max-w-full text-center font-manrope text-[20px] font-semibold leading-[normal] tracking-[0] text-white/90 md:text-[24.5px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Based off your entries, you fall into the following user archetype
        </motion.p>

        <div className="grid w-full grid-cols-1 justify-items-center gap-[24px] md:grid-cols-3 md:items-start md:gap-[18px] lg:gap-[29px]">
          {archetypes.map((archetype) => (
            <ArchetypeCard
              key={archetype.id}
              archetype={archetype}
              isSelected={archetype.id === selectedArchetypeId}
              onSelect={() => setSelectedArchetypeId(archetype.id)}
            />
          ))}
        </div>

        <EnterActionButton
          label="CONTINUE"
          onClick={onComplete}
          className="self-center"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the component and data tests**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts src/app/components/ArchetypeAnalysisScreen.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/app/components/ArchetypeAnalysisScreen.tsx src/app/components/ArchetypeAnalysisScreen.test.ts
git commit -m "feat: add archetype analysis screen"
```

## Task 3: Reflect Flow Wiring

**Files:**
- Create: `src/app/App.test.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the failing app flow test**

Create `src/app/App.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App reflection archetype flow", () => {
  const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  it("registers the archetype analysis screen", () => {
    expect(source).toContain("import { ArchetypeAnalysisScreen }");
    expect(source).toContain("| 'archetypeAnalysis'");
    expect(source).toContain("archetypeAnalysis: 'size-full'");
    expect(source).toContain("case 'archetypeAnalysis'");
  });

  it("routes reflection analysis through archetype analysis before the prompt", () => {
    expect(source).toContain(
      "const handleAnalysisComplete = useCallback(\n\t\t() => setScreen('archetypeAnalysis'),",
    );
    expect(source).toContain(
      "const handleArchetypeComplete = useCallback(\n\t\t() => setScreen('reflectionPrompt'),",
    );
    expect(source).toContain("onComplete={handleArchetypeComplete}");
  });
});
```

- [ ] **Step 2: Run the app flow test to verify it fails**

Run:

```bash
npm test -- src/app/App.test.ts
```

Expected: FAIL because `App.tsx` does not import or render `ArchetypeAnalysisScreen`.

- [ ] **Step 3: Wire the new screen into `App.tsx`**

Modify `src/app/App.tsx`:

1. Add the import near the existing component imports:

```ts
import { ArchetypeAnalysisScreen } from './components/ArchetypeAnalysisScreen';
```

2. Add the screen state:

```ts
type Screen =
  | 'greeting'
  | 'gratitude'
  | 'activity'
  | 'journalEntry'
  | 'reflectionAnalysis'
  | 'archetypeAnalysis'
  | 'reflectionPrompt'
  | 'reflectionWriting'
  | 'completedReflectionWriting'
  | 'writing'
  | 'completedWriting'
  | 'postReflectionActivity'
  | 'postWriting'
  | 'completedPostWriting'
  | 'complete';
```

3. Add the wrapper class:

```ts
const SCREEN_WRAPPER_CLASS: Record<Screen, string> = {
  greeting: 'size-full',
  gratitude: 'size-full',
  activity: 'size-full',
  journalEntry: 'size-full',
  reflectionAnalysis: 'size-full',
  archetypeAnalysis: 'size-full',
  reflectionPrompt: 'size-full',
  reflectionWriting: 'size-full',
  completedReflectionWriting: 'size-full',
  writing: 'size-full',
  completedWriting: 'size-full',
  postReflectionActivity: 'size-full',
  postWriting: 'size-full',
  completedPostWriting: 'size-full',
  complete: 'size-full',
};
```

4. Change `handleAnalysisComplete` and add `handleArchetypeComplete`:

```ts
const handleAnalysisComplete = useCallback(
  () => setScreen('archetypeAnalysis'),
  [],
);
const handleArchetypeComplete = useCallback(
  () => setScreen('reflectionPrompt'),
  [],
);
```

5. Add a switch case between `reflectionAnalysis` and `reflectionPrompt`:

```tsx
case 'archetypeAnalysis':
  screenNode = (
    <ArchetypeAnalysisScreen
      onComplete={handleArchetypeComplete}
    />
  );
  break;
```

- [ ] **Step 4: Run the app flow test**

Run:

```bash
npm test -- src/app/App.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all focused archetype tests**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts src/app/components/ArchetypeAnalysisScreen.test.ts src/app/App.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/app/App.tsx src/app/App.test.ts
git commit -m "feat: route reflect flow through archetype analysis"
```

## Task 4: Visual QA And Build Verification

**Files:**
- Modify only if QA finds issues:
  - `src/app/components/ArchetypeAnalysisScreen.tsx`
  - `src/app/App.tsx`
- Create: `design-qa.md`

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 2: Run the focused tests**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts src/app/components/ArchetypeAnalysisScreen.test.ts src/app/App.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 5: Start the local app**

Run:

```bash
npm run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 6: Compare the implementation against Figma**

Open the local app. If the app redirects to login and no local test account is available, create `design-qa.md` with `final result: blocked` and the note `Local auth blocked visual QA`. Do not add a preview-only route.

If an authenticated local session is available, navigate through:

1. Reflect.
2. Journal entry.
3. Existing reflection analysis.
4. New archetype analysis screen.

Compare against Figma node `70:648`. Check:

- Dark stage and warm outer shell match the existing app shell.
- Heading copy is centered and readable.
- Three cards appear in the same order: `ANCHOR`, `SEEKER`, `CHALLENGER`.
- `SEEKER` starts selected with orange border and outer tinted stroke.
- Unselected cards are muted.
- Tags render as small outlined pills.
- Cards stack cleanly on mobile width.
- Clicking another card moves the selected state.
- Enter continues to the reflection prompt.

- [ ] **Step 7: Save the QA report**

Create `design-qa.md`:

```md
# Design QA

Reference: Figma node `70:648`.

## Checks

- Dark stage and warm outer shell: passed
- Heading alignment and copy: passed
- Card order: passed
- Initial selected archetype: passed
- Muted unselected cards: passed
- Tag styling: passed
- Mobile stacking: passed
- Card click selection: passed
- Enter-to-continue: passed

final result: passed
```

If any check fails, write `final result: blocked`, list the mismatch, fix it, rerun focused tests and build, then update this report.

- [ ] **Step 8: Commit visual QA**

Run:

```bash
git add design-qa.md
git commit -m "test: add archetype design qa"
```

## Task 5: Final Verification

**Files:**
- No new files unless a verification issue requires a fix.

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional uncommitted changes, or clean.

- [ ] **Step 2: Run final focused verification**

Run:

```bash
npm test -- src/app/components/archetype-data.test.ts src/app/components/ArchetypeAnalysisScreen.test.ts src/app/App.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run final build verification**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 4: Keep the dev server running for handoff**

If no dev server is running, run:

```bash
npm run dev
```

Expected: local app URL is available for the user.

- [ ] **Step 5: Handoff**

Report:

- Local URL.
- Files changed.
- Verification commands and results.
- Any remaining visual notes from `design-qa.md`.

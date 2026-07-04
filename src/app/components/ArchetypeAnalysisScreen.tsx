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

const interactiveSelector = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function shouldIgnoreGlobalEnter(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(interactiveSelector) !== null;
}

const toneClasses: Record<
  ArchetypeTone,
  {
    selectedText: string;
    mutedText: string;
    border: string;
    selectedRing: string;
    mutedBorder: string;
  }
> = {
  green: {
    selectedText: "text-[#6bde7c]",
    mutedText: "text-[rgba(107,222,124,0.42)]",
    border: "border-[rgba(107,222,124,0.42)]",
    selectedRing: "border-[rgba(107,222,124,0.22)]",
    mutedBorder: "border-[rgba(107,222,124,0.32)]",
  },
  orange: {
    selectedText: "text-[#ff845f]",
    mutedText: "text-[rgba(255,132,95,0.5)]",
    border: "border-[#ff845f]",
    selectedRing: "border-[rgba(255,132,95,0.22)]",
    mutedBorder: "border-[rgba(255,132,95,0.32)]",
  },
  purple: {
    selectedText: "text-[#bd7cff]",
    mutedText: "text-[rgba(189,124,255,0.42)]",
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
            ? cn(tone.border, tone.selectedText, "opacity-100")
            : cn(tone.mutedBorder, tone.mutedText, "opacity-50 hover:opacity-70"),
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
      if (event.key === 'Enter' && !shouldIgnoreGlobalEnter(event.target)) {
        onComplete();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onComplete]);

  return (
    <div className="flex size-full flex-col items-center justify-center overflow-y-auto px-[24px] py-[56px]">
      <div className="flex w-full max-w-[908px] flex-col items-center gap-[32px] md:gap-[39px]">
        <motion.h1
          className="max-w-full text-center font-manrope text-[20px] font-semibold leading-[normal] tracking-[0] text-white/90 md:text-[24.5px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Based off your entries, you fall into the following user archetype
        </motion.h1>

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

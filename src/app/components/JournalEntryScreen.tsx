import { useEffect } from "react";
import { motion } from "motion/react";
import { FadeScreen, ScreenHeader } from "./shared/screen-primitives";

const zigzagPath = "M17.6551 0L8.82759 4H26.4827H44.1379H61.7931H79.4482H97.1034H114.759H132.414H150.069H167.724H185.379H203.034H220.69H238.345H256H273.655H291.31H308.966H326.621H344.276H361.931H379.586H397.241H414.897H432.552H450.207H467.862H485.517H503.172L494.345 0L485.517 4L476.69 0L467.862 4L459.034 0L450.207 4L441.379 0L432.552 4L423.724 0L414.897 4L406.069 0L397.241 4L388.414 0L379.586 4L370.759 0L361.931 4L353.103 0L344.276 4L335.448 0L326.621 4L317.793 0L308.966 4L300.138 0L291.31 4L282.483 0L273.655 4L264.828 0L256 4L247.172 0L238.345 4L229.517 0L220.69 4L211.862 0L203.034 4L194.207 0L185.379 4L176.552 0L167.724 4L158.897 0L150.069 4L141.241 0L132.414 4L123.586 0L114.759 4L105.931 0L97.1034 4L88.2758 0L79.4482 4L70.6207 0L61.7931 4L52.9655 0L44.1379 4L35.3103 0L26.4827 4L17.6551 0Z";

interface JournalEntryScreenProps {
  currentDate: string;
  currentTime: string;
  entry?: { entry_date: string | null; entry_text: string };
  error?: string | null;
  onContinue: () => void;
}

function formatEntryDate(entryDate: string | null): string {
  if (!entryDate) return "RECENT ENTRY";

  const date = new Date(entryDate);
  if (Number.isNaN(date.getTime())) return entryDate.toUpperCase();

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }).toUpperCase();
}

export function JournalEntryScreen({ currentDate, currentTime, entry, error, onContinue }: JournalEntryScreenProps) {
  useEffect(() => {
    if (!entry) return;
    const timer = setTimeout(onContinue, 4000);
    return () => clearTimeout(timer);
  }, [entry, onContinue]);

  return (
    <FadeScreen>
      {/* Header */}
      <ScreenHeader currentDate={currentDate} currentTime={currentTime} />

      {/* Content */}
      <div className="screen-content-rail">
        <motion.div
          className="flex flex-col gap-[16px] items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {!entry && !error && (
            <p className="font-roboto-mono font-medium leading-[normal] text-[12px] text-[rgba(255,255,255,0.4)]">
              FINDING A THREAD TO REFLECT ON
            </p>
          )}

          {error && (
            <p className="font-inter font-medium leading-[1.5] text-[16px] text-[rgba(255,255,255,0.7)] text-center max-w-[420px]">
              {error}
            </p>
          )}

          {entry && (
            <>
          <p className="font-roboto-mono font-medium leading-[normal] text-[12px] text-[rgba(255,255,255,0.4)]">{formatEntryDate(entry.entry_date)}</p>

          <div className="flex flex-col items-start w-[512px] max-w-full">
            {/* Top zigzag */}
            <div className="h-[4px] w-full">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 512 4">
                <path d="M0 0L8.82759 4H0V0Z" fill="#DED2C3" />
                <path d={zigzagPath} fill="#DED2C3" />
                <path d="M512 0L503.172 4H512V0Z" fill="#DED2C3" />
              </svg>
            </div>

            {/* Paper body */}
            <div className="bg-[#ded2c3] w-full">
              <div className="flex items-center justify-center p-[48px]">
                <p className="flex-1 font-pangolin leading-[1.5] text-[20px] text-[rgba(0,0,0,0.4)]">
                  {entry.entry_text}
                </p>
              </div>
            </div>

            {/* Bottom zigzag (flipped) */}
            <div className="flex items-center justify-center w-full">
              <div className="-scale-y-100 w-full">
                <div className="h-[4px] w-full">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 512 4">
                    <path d="M0 0L8.82759 4H0V0Z" fill="#DED2C3" />
                    <path d={zigzagPath} fill="#DED2C3" />
                    <path d="M512 0L503.172 4H512V0Z" fill="#DED2C3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </motion.div>
      </div>
    </FadeScreen>
  );
}

import { motion } from "motion/react";
import { FadeScreen } from "./shared/screen-primitives";

interface GreetingScreenProps {
  userName: string;
  greeting: string;
}

export function GreetingScreen({ userName, greeting }: GreetingScreenProps) {
  return (
    <FadeScreen className="content-stretch relative flex h-full min-h-px min-w-px flex-1">
      <motion.p
        className="font-manrope font-semibold leading-[normal] text-[24px] text-[rgba(255,255,255,0.9)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        {greeting}, {userName}.
      </motion.p>
    </FadeScreen>
  );
}

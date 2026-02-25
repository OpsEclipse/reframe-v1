import type { ComponentPropsWithoutRef } from "react";
import { motion } from "motion/react";

import { LoadingIcon } from "./loading-icon";
import { cn } from "./utils";

type LoadingIconTextProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  color?: string;
  iconClassName?: string;
  iconSize?: number;
  text?: string;
  textClassName?: string;
};

function LoadingIconText({
  className,
  color = "#888",
  iconClassName,
  iconSize = 28,
  text = "Loading...",
  textClassName,
  ...props
}: LoadingIconTextProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <div
        data-slot="loading-icon-text"
        role="status"
        aria-live="polite"
        className={cn("inline-flex flex-col items-center gap-1.5", className)}
        {...props}
      >
        <LoadingIcon className={iconClassName} color={color} decorative size={iconSize} />
        <span className={cn("text-xs font-medium leading-none text-muted-foreground", textClassName)}>{text}</span>
      </div>
    </motion.div>
  );
}

export { LoadingIconText };
export type { LoadingIconTextProps };

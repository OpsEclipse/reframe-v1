import type { ComponentPropsWithoutRef } from "react";
import { motion } from "motion/react";

import { cn } from "./utils";

const FRAME_PATH = "M500 0H0V500H500V0ZM449.5 49.5H49.5V449.5H449.5V49.5Z";

type LoadingIconProps = ComponentPropsWithoutRef<"div"> & {
  color?: string;
  decorative?: boolean;
  label?: string;
  size?: number;
};

function LoadingIcon({
  className,
  color = "#888",
  decorative = false,
  label = "Loading",
  size = 80,
  style,
  ...props
}: LoadingIconProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <div
        aria-hidden={decorative}
        aria-label={decorative ? undefined : label}
        data-slot="loading-icon"
        role={decorative ? undefined : "status"}
        className={cn("inline-flex shrink-0", className)}
        style={{ height: size, width: size, ...style }}
        {...props}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 500 500"
          width="100%"
        >
          <style>{`
          @keyframes bar-top {
            0%, 100% {
              transform: scaleX(1) scaleY(1);
            }
            25% {
              transform: scaleX(1.15) scaleY(0.6);
            }
            50% {
              transform: scaleX(0.85) scaleY(1.3);
            }
            75% {
              transform: scaleX(1.05) scaleY(0.9);
            }
          }
          @keyframes bar-bottom {
            0%, 100% {
              transform: scaleX(1) scaleY(1);
            }
            25% {
              transform: scaleX(0.85) scaleY(1.3);
            }
            50% {
              transform: scaleX(1.15) scaleY(0.6);
            }
            75% {
              transform: scaleX(0.95) scaleY(1.1);
            }
          }
          .bar-top {
            animation: bar-top 1.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
            transform-origin: 250px 185px;
          }
          .bar-bottom {
            animation: bar-bottom 1.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
            transform-origin: 250px 315px;
          }
        `}</style>
          <path clipRule="evenodd" d={FRAME_PATH} fill={color} fillRule="evenodd" opacity={0.4} />
          <rect className="bar-top" fill={color} height={80} opacity={0.7} rx={4} width={200} x={150} y={145} />
          <rect
            className="bar-bottom"
            fill={color}
            height={80}
            opacity={0.7}
            rx={4}
            width={200}
            x={150}
            y={275}
          />
        </svg>
      </div>
    </motion.div>
  );
}

export { LoadingIcon };
export type { LoadingIconProps };

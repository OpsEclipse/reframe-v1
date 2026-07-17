import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, type MotionProps } from "motion/react";
import { cn } from "../ui/utils";

interface FadeScreenProps extends MotionProps {
  children: ReactNode;
  className?: string;
}

export function FadeScreen({ children, className, ...motionProps }: FadeScreenProps) {
  return (
    <motion.div
      className={cn("screen-root", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

interface ScreenHeaderProps {
  currentDate: string;
  currentTime: string;
  className?: string;
}

export function ScreenHeader({ currentDate, currentTime, className }: ScreenHeaderProps) {
  return (
    <div className={cn("screen-header", className)}>
      <p className="screen-header-date">{currentDate}</p>
      <p className="screen-header-time">{currentTime}</p>
    </div>
  );
}

interface EnterIconProps {
  tone?: "light" | "dark";
}

export function EnterIcon({ tone = "light" }: EnterIconProps) {
  return (
    <div className="relative size-[16px] shrink-0">
      <svg
        className="absolute block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M7.33359 5.99994L8.28026 6.9466L5.88693 9.33327H12.0003V2.6666H13.3336V10.6666H5.88693L8.28026 13.0533L7.33359 13.9999L3.33359 9.99994L7.33359 5.99994Z"
          fill={tone === "dark" ? "black" : "white"}
          fillOpacity="0.5"
        />
      </svg>
    </div>
  );
}

interface EnterActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: "light" | "dark";
  variant?: "outline" | "solid";
}

export function EnterActionButton({
  label,
  tone = "light",
  variant = "outline",
  className,
  ...buttonProps
}: EnterActionButtonProps) {
  return (
    <button
      className={cn(variant === "solid" ? "action-solid" : "action-outline", className)}
      {...buttonProps}
    >
      <div aria-hidden="true" className="action-border" />
      <p className={tone === "dark" ? "action-label-dark" : "action-label-light"}>
        {label}
      </p>
      <EnterIcon tone={tone} />
    </button>
  );
}

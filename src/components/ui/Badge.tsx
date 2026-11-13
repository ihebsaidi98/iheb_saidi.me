import React from "react";
import { twMerge } from "tailwind-merge";

export type BadgeVariant = "default" | "mono" | "emerald" | "cyan" | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-white/10 bg-white/[0.03] text-white/60",
  mono: "border-white/10 bg-white/[0.03] text-white/60 font-mono text-[10px] tracking-wider",
  emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-300 font-mono text-[10px]",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-mono text-[10px]",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200 font-mono text-[10px]",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

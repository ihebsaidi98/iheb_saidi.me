import React, { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export type CardVariant = "default" | "subtle" | "elevated" | "interactive";

const variantClasses: Record<CardVariant, string> = {
  default: "border border-border-subtle bg-bg-surface text-text-primary",
  subtle: "border border-white/[0.07] bg-white/[0.02] text-text-primary",
  elevated:
    "border border-border-strong bg-bg-elevated text-text-primary shadow-[0_12px_40px_rgba(0,0,0,0.28)]",
  interactive:
    "border border-white/[0.07] bg-white/[0.02] text-text-primary transition-all duration-300 hover:border-white/[0.13] hover:bg-white/[0.04] focus-within:ring-1 focus-within:ring-emerald-400/50",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  as?: React.ElementType;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", as: Component = "div", className = "", children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={twMerge("rounded-2xl transition-all", variantClasses[variant], className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div ref={ref} className={twMerge("flex flex-col space-y-1.5 p-5 pb-0", className)} {...props}>
        {children}
      </div>
    );
  }
);
CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = "h3", className = "", children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={twMerge("text-base font-semibold text-text-primary", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <p ref={ref} className={twMerge("text-xs leading-relaxed text-text-tertiary", className)} {...props}>
        {children}
      </p>
    );
  }
);
CardDescription.displayName = "CardDescription";

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div ref={ref} className={twMerge("p-5 pt-3", className)} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = "CardContent";

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge("mt-auto flex items-center justify-between border-t border-border-subtle/50 p-5 pt-3", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = "CardFooter";

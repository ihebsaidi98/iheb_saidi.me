"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-emerald-200/25 bg-emerald-300/[0.08] text-text-primary transition-all duration-slow ease-out-quart hover:-translate-y-0.5 hover:bg-emerald-300/[0.14] hover:shadow-[0_8px_40px_rgba(16,185,129,0.25)]",
  secondary:
    "border border-border-subtle bg-bg-surface/90 text-text-secondary transition-colors duration-base hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary",
  outline:
    "border border-white/15 bg-transparent text-text-secondary transition-colors duration-base hover:border-white/30 hover:text-text-primary",
  ghost:
    "border-transparent bg-transparent text-text-tertiary transition-colors duration-fast hover:text-text-secondary hover:bg-white/[0.04]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-xs sm:text-sm font-semibold",
  lg: "px-7 py-3.5 text-sm font-semibold",
  icon: "size-10 p-0 items-center justify-center",
};

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export type ButtonAsButton = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: undefined;
  };

export type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    href: string;
    download?: boolean | string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className = "",
      children,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const combinedClasses = twMerge(
      "group inline-flex items-center justify-center rounded-full font-semibold transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
      "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
      disabled && "pointer-events-none cursor-not-allowed opacity-40",
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    if ("href" in props && typeof props.href === "string") {
      const { href, download, onClick, ...linkProps } = props as ButtonAsLink;
      const isInternal = href.startsWith("/") || href.startsWith("#");
      const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      };
      const disabledLinkProps = {
        "aria-disabled": disabled || undefined,
        tabIndex: disabled ? -1 : linkProps.tabIndex,
        onClick: handleClick,
      };

      if (download || !isInternal) {
        return (
          <a
            ref={ref as React.ForwardedRef<HTMLAnchorElement>}
            href={href}
            download={download}
            className={combinedClasses}
            {...linkProps}
            {...disabledLinkProps}
          >
            {children}
          </a>
        );
      }

      return (
        <Link
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          className={combinedClasses}
          {...linkProps}
          {...disabledLinkProps}
        >
          {children}
        </Link>
      );
    }

    const buttonProps = props as ButtonAsButton;
    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type={buttonProps.type ?? "button"}
        className={combinedClasses}
        disabled={disabled}
        {...buttonProps}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

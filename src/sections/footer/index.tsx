"use client";

import { useState } from "react";
import { profile } from "@/data/profile";
import { Button } from "@/components/ui/Button";

const navItems = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Contact", href: "#contact" },
] as const;

const socials = [
  { label: "GitHub", href: profile.github },
  { label: "LinkedIn", href: profile.linkedin },
] as const;

export function Footer() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
    } catch {
      window.prompt("Copy email:", profile.email);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer
      id="footer"
      aria-labelledby="footer-title"
      className="relative isolate border-t border-white/[0.07] bg-surface/95 py-24 md:py-32"
    >
      <h2 id="footer-title" className="sr-only">Footer</h2>
      <div className="mx-auto max-w-6xl px-6 sm:px-8 flex flex-col items-center justify-between gap-10 sm:flex-row sm:items-start sm:justify-between">
        {/* Left — Identity */}
        <div className="flex flex-col items-center gap-2.5 sm:items-start sm:text-left">
          <span className="font-semibold text-[18px] tracking-[-0.01em] text-text-primary">
            {profile.name}
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">
            {profile.title}
          </span>
          <span className="font-mono text-[10px] tracking-[0.15em] text-white/50">
            © {new Date().getFullYear()} {profile.name}
          </span>
        </div>

        {/* Right — Nav, Socials, CV, Info, Back to top */}
        <div className="flex flex-col items-center sm:items-start gap-6 w-full sm:w-auto">
          {/* Secondary navigation */}
          <div className="flex flex-wrap gap-4 sm:gap-6 items-center justify-center sm:justify-start">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`
                  inline-flex items-center
                  font-mono text-[10px] tracking-[0.15em] text-white/60
                  transition-colors hover:text-white
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                  rounded-full px-2 py-1
                  min-h-[44px] min-w-[44px]
                `}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Socials + CV */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-center sm:justify-start">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className={`
                  inline-flex items-center gap-1.5
                  rounded-full border border-white/10 bg-white/[0.03]
                  px-2.5 py-0.5 text-xs font-mono text-white/60
                  transition-colors hover:text-white hover:border-white/30
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                  min-h-[44px] min-w-[44px]
                `}
              >
                {social.label}
                <span aria-hidden className="text-[10px]">↗</span>
              </a>
            ))}
            <Button
              href={profile.cv}
              download
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              Download CV
            </Button>
            <button
              onClick={copyEmail}
              aria-label={copied ? "Email copied to clipboard" : "Copy email to clipboard"}
              aria-live="polite"
              className={`
                inline-flex items-center gap-1.5
                rounded-full border border-white/10 bg-white/[0.03]
                px-2.5 py-0.5 text-xs font-mono text-white/60
                transition-colors hover:text-white hover:border-white/30
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                min-h-[44px] min-w-[44px]
              `}
            >
              {copied ? (
                <span className="text-emerald-300">copied</span>
              ) : (
                <span className="truncate">{profile.email}</span>
              )}
              <span aria-hidden className="text-[10px] text-white/55 transition-colors group-hover:text-white/60">
                {copied ? "✓" : "⧉"}
              </span>
            </button>
          </div>

          {/* Location + time */}
          <div className="font-mono text-[10px] tracking-[0.2em] text-white/50 tabular-nums">
            Based in Tunisia · I usually respond promptly
          </div>

          {/* Back to top */}
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
          >
            BACK TO TOP ↑
          </Button>
        </div>
      </div>
    </footer>
  );
}

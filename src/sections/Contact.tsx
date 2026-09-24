"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { Magnetic } from "@/components/ui/Magnetic";
import { StatusDot } from "@/components/ui/StatusDot";
import { availability, locationShort } from "@/data/site";
import { useLocalTime } from "@/hooks/useLocalTime";
import { profile } from "@/data/profile";

export function ContactSection() {
  const [copied, setCopied] = useState(false);
  const time = useLocalTime();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
    } catch {
      window.prompt("Copy email:", profile.email);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const socials = [
    { label: "GitHub", href: profile.github },
    { label: "LinkedIn", href: profile.linkedin },
  ].filter((s) => s.href);

  return (
    <section id="contact" className="relative overflow-hidden py-28 sm:py-40">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/[0.05] blur-[120px]"
      />

      <div className="container relative mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="inline-flex items-center gap-2.5">
            <StatusDot size={8} className="shrink-0" />
            <span className="font-mono text-[9px] font-medium tracking-[0.22em] text-emerald-200/70">
              {availability}
            </span>
          </div>

          <h2 className="mx-auto mt-6 max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.05em] text-white sm:text-7xl">
            Let&apos;s build something{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
              shipping-grade.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-md text-pretty text-base leading-7 text-white/50">
            Full-stack roles, backend-heavy teams, or anything where the system
            has to stay up. Currently based in Tunis, open to relocation.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Magnetic>
              {/* Download uses `profile.cv` to avoid a hardcoded filename */}
              <a
                href={profile.cv}
                download
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-300/[0.08] px-7 py-3.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-emerald-300/[0.14] hover:shadow-[0_8px_40px_rgba(16,185,129,0.25)]"
              >
                Download résumé
                <span aria-hidden>↓</span>
              </a>
            </Magnetic>

            <Magnetic>
              <button
                onClick={copyEmail}
                className="group inline-flex items-center gap-2.5 rounded-full border border-white/15 px-6 py-3.5 font-mono text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
                aria-live="polite"
              >
                <span className="text-emerald-300/80">&gt;_</span>
                {copied ? (
                  <span className="text-emerald-300">copied to clipboard</span>
                ) : (
                  <span className="truncate">{profile.email}</span>
                )}
                <span aria-hidden className="text-white/30 transition-colors group-hover:text-white/60">
                  {copied ? "✓" : "⧉"}
                </span>
              </button>
            </Magnetic>
          </div>

          {socials.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-6">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1.5 px-2 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white"
                >
                  {s.label}
                  <span aria-hidden className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          )}

          <p className="mt-10 font-mono text-[10px] tracking-[0.2em] text-white/25 tabular-nums">
            {locationShort.toUpperCase()} · {time} · TYPICALLY REPLIES WITHIN 24H
          </p>
        </motion.div>
      </div>
    </section>
  );
}
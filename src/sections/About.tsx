"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { IdentityCard } from "@/components/about/IdentityCard";
import { NeuralMesh } from "@/components/about/NeuralMesh";
import { SignalMeter } from "@/components/about/SignalMeter";
import { EASE } from "@/components/hero-motion";
import { SectionShell } from "@/components/ui/SectionShell";
import { SKILL_GROUPS } from "@/data/about";

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative font-mono text-emerald-300/90">
      {children}
      <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-px bg-emerald-300/40" />
    </span>
  );
}

function RevealP({
  children,
  delay = 0,
  reduce = false,
}: {
  children: React.ReactNode;
  delay?: number;
  reduce?: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0)", y: 12 }}
      whileInView={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function AboutSection() {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion ?? false;
  const hostRef = useRef<HTMLDivElement | null>(null);

  return (
    <SectionShell
      id="about"
      index="01"
      eyebrow="ABOUT"
      title={
        <>
          Engineer by training,
          <br />
          <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
            builder by default.
          </span>
        </>
      }
    >
      <div ref={hostRef} className="relative">
        <NeuralMesh
          hostRef={hostRef}
          className="pointer-events-none absolute -inset-x-6 -top-12 bottom-0 z-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]"
        />

        <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-12">
          <IdentityCard />

          <div className="relative min-w-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 right-0 hidden select-none font-serif text-[9rem] leading-none text-white/[0.03] sm:block lg:text-[12rem] xl:text-[15rem]"
            >
              01
            </div>

            <div className="relative space-y-4 text-pretty text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
              <RevealP reduce={shouldReduce} delay={0}>
                <p>
                  I&apos;m a full-stack engineer focused on <Mono>Spring Boot</Mono>{" "}
                  backends and <Mono>Angular</Mono> frontends — the unglamorous middle
                  where business logic, data integrity, and user experience actually
                  meet.
                </p>
              </RevealP>
              <RevealP reduce={shouldReduce} delay={0.12}>
                <p>
                  I care about <Mono>clean architecture</Mono>, observable systems, and
                  code the next engineer thanks me for — lately through{" "}
                  <Mono>event-driven microservices</Mono> and resilient delivery.
                </p>
              </RevealP>
              <RevealP reduce={shouldReduce} delay={0.24}>
                <p>
                  AI is part of that stack now: <Mono>RAG</Mono> pipelines over{" "}
                  <Mono>pgvector</Mono>, <Mono>Spring AI</Mono> modules with real tests
                  and guardrails, and <Mono>Claude Code</Mono> as a daily pair. The
                  machine drafts fast; I own the architecture and every line that ships.
                  {shouldReduce ? (
                    <span aria-hidden className="ml-1 font-mono text-emerald-300/90">▍</span>
                  ) : (
                    <motion.span
                      aria-hidden
                      animate={{ opacity: [1, 1, 0, 0] }}
                      transition={{
                        duration: 1.1,
                        times: [0, 0.45, 0.5, 1],
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }}
                      className="ml-1 inline-block font-mono text-emerald-300/90"
                    >
                      ▍
                    </motion.span>
                  )}
                </p>
              </RevealP>
            </div>

            <div className="relative mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
              {SKILL_GROUPS.map((group, groupIndex) => (
                <div key={group.label}>
                  <h3 className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                    <span aria-hidden className="text-emerald-300/70">▸</span>
                    {group.label}
                    <motion.span
                      aria-hidden
                      initial={shouldReduce ? false : { scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={
                        shouldReduce ? { duration: 0 } : { duration: 0.8, ease: EASE, delay: 0.2 }
                      }
                      className="h-px flex-1 origin-left bg-white/[0.07]"
                    />
                  </h3>

                  <div className="mt-5 space-y-5">
                    {group.skills.map((skill, skillIndex) => (
                      <SignalMeter
                        key={skill.name}
                        {...skill}
                        delay={shouldReduce ? 0 : groupIndex * 0.08 + skillIndex * 0.05}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

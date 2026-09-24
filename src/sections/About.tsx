"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { IdentityCard } from "@/components/about/IdentityCard";
import { NeuralMesh } from "@/components/about/NeuralMesh";
import { TechStackFiles } from "@/components/about/TechStackFiles";
import { EASE } from "@/components/hero-motion";
import { SectionShell } from "@/components/ui/SectionShell";

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
              className="decorative-watermark pointer-events-none absolute -top-10 right-0 hidden select-none font-serif text-[9rem] leading-none text-white/[0.03] sm:block lg:text-[12rem] xl:text-[15rem]"
            >
              01
            </div>

            <div className="relative space-y-4 text-pretty text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
              <RevealP reduce={shouldReduce} delay={0}>
                <p>
                  I&apos;m a full-stack engineer focused on <Mono>Spring Boot</Mono>{" "}
                  backends and <Mono>Angular</Mono> frontends — working in the
                  unglamorous middle where business logic, data, APIs, and user
                  experience meet.
                </p>
              </RevealP>

              <RevealP reduce={shouldReduce} delay={0.12}>
                <p>
                  I care about <Mono>clean architecture</Mono>, observable systems, and
                  code the next engineer can trust. I build software for real-world
                  constraints, from <Mono>event-driven microservices</Mono> to
                  resilient delivery and production-ready systems.
                </p>
              </RevealP>

              <RevealP reduce={shouldReduce} delay={0.24}>
                <p>
                  AI is part of that stack too: <Mono>RAG</Mono> pipelines with{" "}
                  <Mono>pgvector</Mono>, <Mono>Spring AI</Mono> integrations, and
                  production-minded systems with proper testing and guardrails. I use AI
                  to move faster — but I own the architecture, the engineering decisions,
                  and everything that ships.
                  {shouldReduce ? (
                    <span
                      aria-hidden
                      className="ml-1 font-mono text-emerald-300/90"
                    >
                      ▍
                    </span>
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
          </div>
        </div>

        <div className="relative z-10 mt-14 sm:mt-16">
          <TechStackFiles />
        </div>
      </div>
    </SectionShell>
  );
}
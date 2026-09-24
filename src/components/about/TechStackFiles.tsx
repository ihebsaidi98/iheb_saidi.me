"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CopyButton } from "@/components/CopyButton";
import { EASE } from "@/components/hero-motion";
import { SKILL_GROUPS, type SkillGroup } from "@/data/about";

type Token = { text: string; className: string };

const CLS = {
  punct: "text-white/25",
  string:
    "text-amber-200/80 transition-colors duration-300 group-hover/line:text-amber-100",
  comment: "text-white/25",
};

function toFileName(label: string) {
  return `${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.json`;
}

function buildGroupLines(group: SkillGroup): Token[][] {
  const nameWidth = Math.max(...group.skills.map((skill) => skill.name.length));
  const lines: Token[][] = [[{ text: "[", className: CLS.punct }]];

  group.skills.forEach((skill, skillIndex) => {
    const isLast = skillIndex === group.skills.length - 1;
    const pad = " ".repeat(nameWidth - skill.name.length);

    const tokens: Token[] = [
      { text: `  "${skill.name}"`, className: CLS.string },
      { text: `${pad}${isLast ? " " : ","} `, className: CLS.punct },
    ];

    if (skill.note) {
      tokens.push({ text: `// ${skill.note}`, className: CLS.comment });
    }

    lines.push(tokens);
  });

  lines.push([{ text: "]", className: CLS.punct }]);
  return lines;
}

const GROUPS = SKILL_GROUPS.map((group) => ({
  file: toFileName(group.label),
  lines: buildGroupLines(group),
}));

// Clean JSON (no comments) — this is what the copy button gives you.
const RAW_JSON = JSON.stringify(
  Object.fromEntries(
    SKILL_GROUPS.map(
      (group): [string, string[]] => [
        group.label,
        group.skills.map((skill) => skill.name),
      ],
    ),
  ),
  null,
  2,
);

function StackFileCard({
  file,
  lines,
  index,
  isLast,
}: {
  file: string;
  lines: Token[][];
  index: number;
  isLast: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;

  return (
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={
        shouldReduce
          ? { duration: 0 }
          : { duration: 0.55, ease: EASE, delay: index * 0.09 }
      }
      className="group/card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] transition-colors duration-500 hover:border-emerald-300/20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-emerald-300/[0.05] via-transparent to-cyan-400/[0.04] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
      />

      <div className="relative flex items-center gap-2 border-b border-white/[0.07] px-3.5 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[#ff5f57]/50" />
          <span className="size-2 rounded-full bg-[#febc2e]/50" />
          <span className="size-2 rounded-full bg-[#28c840]/50" />
        </div>
        <span className="ml-1 font-mono text-[10px] tracking-wider text-white/35 transition-colors duration-300 group-hover/card:text-emerald-200/70">
          {file}
        </span>
      </div>

      <div className="relative overflow-x-auto px-3.5 py-3">
        <div className="font-mono text-[11px] leading-6 sm:text-[12px]">
          {lines.map((tokens, lineIndex) => (
            <motion.div
              key={lineIndex}
              initial={shouldReduce ? false : { opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={
                shouldReduce
                  ? { duration: 0 }
                  : {
                      duration: 0.3,
                      ease: EASE,
                      delay: index * 0.09 + 0.15 + lineIndex * 0.06,
                    }
              }
              className="group/line flex whitespace-pre"
            >
              <code>
                {tokens.map((token, tokenIndex) => (
                  <span key={tokenIndex} className={token.className}>
                    {token.text}
                  </span>
                ))}
                {isLast && lineIndex === lines.length - 1 &&
                  (shouldReduce ? (
                    <span aria-hidden className="ml-1 text-emerald-300/90">
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
                      className="ml-1 inline-block text-emerald-300/90"
                    >
                      ▍
                    </motion.span>
                  ))}
              </code>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function TechStackFiles() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
          <span aria-hidden className="mr-2 text-emerald-300/70">
            ▸
          </span>
          ~/stack
        </span>
        <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
        <span className="font-mono text-[10px] tracking-wider text-white/25">
          {GROUPS.length} FILES
        </span>
        <CopyButton value={RAW_JSON}>copy</CopyButton>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {GROUPS.map((group, index) => (
          <StackFileCard
            key={group.file}
            file={group.file}
            lines={group.lines}
            index={index}
            isLast={index === GROUPS.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
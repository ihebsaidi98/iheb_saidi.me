"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef, useState } from "react";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import { profile } from "@/data/profile";
import { useEnvironment } from "@/lib/environment";
import { useCountUp } from "@/hooks/useCountUp";

const HeroScene3D = dynamic(() => import("@/components/HeroScene3D"), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="absolute inset-0 bg-[#04070c]" />
  ),
});

/* ================= DATA ================= */

const ROLES = [
  "scalable Spring Boot backends",
  "reactive Angular frontends",
  "production-grade REST APIs",
  "clean, maintainable architecture",
];

const STACK = ["Java 21", "Spring Boot", "Angular", "TypeScript", "PostgreSQL", "Docker", "AWS"];

const TYPED_CODE = `@RestController
@RequestMapping("/api/v1")
public class OpportunityController {

  private final Engineer iheb =
      Engineer.senior().stack("Java", "Spring", "Angular").build();

  @GetMapping("/hire")
  public ResponseEntity<Offer> hire() {
      return ResponseEntity.ok(Offer.builder()
          .candidate(iheb)
          .availability("IMMEDIATE")
          .relocation(true)
          .build());
  }
}`;

/* ================= TERMINAL TOKENIZER (one-time, module scope) ================= */

type TokenKind = "plain" | "anno" | "str" | "kw";
type Token = { text: string; kind: TokenKind };

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "",
  anno: "text-emerald-300/80",
  str: "text-emerald-300/80",
  kw: "text-sky-300/90",
};

function tokenize(code: string): Token[] {
  const re = /(@[\w.]+|"[^"]*"|\b(?:public|class|return|new|final|private|true|false)\b)/g;
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const idx = m.index;
    if (idx > last) tokens.push({ text: code.slice(last, idx), kind: "plain" });

    const text = m[0];
    tokens.push({
      text,
      kind: text.startsWith("@") ? "anno" : text.startsWith('"') ? "str" : "kw",
    });
    last = idx + text.length;
  }

  if (last < code.length) tokens.push({ text: code.slice(last), kind: "plain" });
  return tokens;
}

const TOKENS: Token[] = tokenize(TYPED_CODE);

function TypedCode({ len }: { len: number }) {
  const nodes: React.ReactNode[] = [];
  let budget = len;

  for (let i = 0; i < TOKENS.length && budget > 0; i++) {
    const t = TOKENS[i];
    const slice = t.text.slice(0, budget);
    budget -= slice.length;
    nodes.push(
      t.kind === "plain" ? (
        slice
      ) : (
        <span key={i} className={TOKEN_CLASS[t.kind]}>
          {slice}
        </span>
      ),
    );
  }

  return <>{nodes}</>;
}

/* ================= SMALL HOOKS ================= */

function useTypewriter(words: string[], enabled: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!enabled) {
      setText(words[0]);
      return;
    }

    let word = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = words[word];
      if (!deleting) {
        char++;
        setText(current.slice(0, char));
        if (char === current.length) {
          deleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
        timer = setTimeout(tick, 45 + Math.random() * 40);
      } else {
        char--;
        setText(current.slice(0, char));
        if (char === 0) {
          deleting = false;
          word = (word + 1) % words.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 22);
      }
    };

    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [words, enabled]);

  return text;
}

function useTypedCode(code: string, enabled: boolean) {
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLen(code.length);
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      i += Math.random() < 0.12 ? 3 : 1;
      i = Math.min(i, code.length);
      setLen(i);
      if (i < code.length) timer = setTimeout(step, 12 + Math.random() * 26);
    };

    timer = setTimeout(step, 1200);
    return () => clearTimeout(timer);
  }, [code, enabled]);

  return len;
}


/* ================= PIECES ================= */

/**
 * memo'd: props never change, so keystroke ticks in TypedRole
 * (and any parent re-render) can't re-render these spans.
 */
const LetterReveal = memo(function LetterReveal({
  text,
  delay,
  gradient = false,
}: {
  text: string;
  delay: number;
  gradient?: boolean;
}) {
  return (
    <span
      className={
        gradient
          ? "hero-letter-mask inline-flex overflow-hidden bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text"
          : "hero-letter-mask inline-flex overflow-hidden"
      }
    >
      {text.split("").map((c, i) => (
        <span
          key={i}
          className={`hero-letter ${gradient ? "text-transparent" : ""}`}
          style={{ animationDelay: `${delay + i * 0.045}s` }}
        >
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </span>
  );
});

/**
 * Isolated leaf: useTypewriter's 20–45ms ticks re-render ONLY this
 * component, not the entire hero section.
 */
const TypedRole = memo(function TypedRole({ words }: { words: string[] }) {
  const { reduceMotion } = useEnvironment();
  const typed = useTypewriter(words, !reduceMotion);

  return (
    <>
      <span className="text-white/85">{typed}</span>
      <span className="ml-1 inline-block h-[14px] w-[8px] translate-y-[2px] bg-emerald-300/90 animate-[hero-caret_1.1s_steps(1)_infinite]" />
    </>
  );
});

function TerminalCard() {
  const { reduceMotion } = useEnvironment();
  const len = useTypedCode(TYPED_CODE, !reduceMotion);

  return (
    <div aria-hidden="true" className="hidden lg:block">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#070b11]/85 shadow-[0_0_80px_rgba(16,185,129,0.07)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
          <span className="size-2.5 rounded-full bg-[#28c840]/70" />
          <span className="ml-3 font-mono text-[10px] tracking-wider text-white/35">
            OpportunityController.java
          </span>
          <span className="ml-auto font-mono text-[10px] text-white/20">UTF-8</span>
        </div>

        <pre className="min-h-[280px] overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-6 text-white/60 lg:min-h-[320px]">
          <code>
            <TypedCode len={len} />
          </code>
          <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] bg-emerald-300/90 animate-[hero-caret_1.1s_steps(1)_infinite]" />
        </pre>

        <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2 font-mono text-[10px] text-white/30">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            build: success
          </span>
          <span>tests: 42/42</span>
          <span className="ml-auto text-emerald-300/60">ready to ship</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { ref, value: displayed } = useCountUp(value);
  return (
    <div>
      <div className="font-serif text-2xl tracking-[-0.04em] text-white sm:text-3xl">
        {/* tabular-nums: stops digit-width jitter during count-up */}
        <span ref={ref} className="tabular-nums">
          {displayed}
          {suffix}
        </span>
      </div>
      <div className="mt-1 max-w-[110px] text-[11px] leading-4 text-white/30">{label}</div>
    </div>
  );
}

/* ================= SECTION ================= */

export const HeroSection = () => {
  const env = useEnvironment();
  const contentRef = useRef<HTMLDivElement>(null);

  /* scroll parallax — rAF-throttled DOM writes; detached once hero is off-screen */
  useEffect(() => {
    const el = contentRef.current;
    if (!el || env.reduceMotion) return;

    let raf = 0;
    let onScreen = true;

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    io.observe(el);

    const update = () => {
      raf = 0;
      if (!onScreen) return;
      const y = window.scrollY;
      el.style.transform = `translate3d(0, ${Math.min(y * 0.06, 60)}px, 0)`;
      el.style.opacity = String(Math.max(1 - y / 650, 0.15));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [env.reduceMotion]);

  return (
    <section
      id="top"
      className="relative isolate h-[100svh] overflow-hidden bg-[#04070c]"
    >
      <HeroScene3D />

      <div className="container relative z-10 mx-auto flex h-full w-full items-center px-6 py-16 lg:py-12">
        <div
          ref={contentRef}
          className="grid w-full items-center gap-14 will-change-transform lg:grid-cols-[1.05fr_0.95fr]"
        >
          {/* LEFT */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[9px] font-medium tracking-[0.22em] text-emerald-200/70">
                AVAILABLE FOR NEW OPPORTUNITIES
              </span>
            </div>

            {/* aria-label on h1: screen readers get the sentence, not letter-by-letter */}
            <h1
              aria-label="Iheb Saidi, full-stack software engineer"
              className="mt-5 font-serif text-[clamp(3rem,12vmin,8rem)] leading-[0.85] tracking-[-0.06em]"
            >
              <span aria-hidden="true" className="inline-block text-balance">
                <LetterReveal text="Iheb" delay={0.15} />
                <br />
                <LetterReveal text="Saidi." delay={0.5} gradient />
              </span>
            </h1>

            <p className="mt-4 font-mono text-sm text-white/50 sm:text-base">
              <span className="text-emerald-300/80">&gt;_</span> I build{" "}
              {/* static sentence for screen readers; animated copy hidden from AT */}
              <span className="sr-only">
                scalable Spring Boot backends, reactive Angular frontends, and
                production-grade APIs.
              </span>
              <span aria-hidden="true">
                <TypedRole words={ROLES} />
              </span>
            </p>

            <p className="mt-4 max-w-lg text-pretty text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
              Full-stack software engineer turning complex backend and frontend
              challenges into simple, reliable, user-loved products.
            </p>

            <div className="hero-stack-chips mt-4 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] tracking-wider text-white/50"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-6">
              <a
                href="#projects"
                className="group inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-300/[0.08] px-6 py-3 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-300/[0.14] hover:shadow-[0_8px_40px_rgba(16,185,129,0.25)]"
              >
                View my work
                <ArrowDown
                  aria-hidden="true"
                  className="size-4 rotate-[-45deg] transition-transform duration-300 group-hover:translate-x-1"
                />
              </a>
              {/* padded to a 44px touch target */}
              <a
                href="#contact"
                className="px-2 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-white/40 transition-colors hover:text-white"
              >
                Get in touch
              </a>
            </div>

            <div className="hero-stats mt-7 grid max-w-md grid-cols-3 border-t border-white/[0.08] pt-4">
              {profile.stats.map((stat, i) => (
                <div key={stat.label} className={i > 0 ? "border-l border-white/[0.08] pl-5" : ""}>
                  <Stat value={stat.value} suffix={stat.suffix} label={stat.label} />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — terminal (aria-hidden, pure decoration) */}
          <TerminalCard />
        </div>
      </div>

      <div className="hero-scroll-hint absolute bottom-7 left-0 right-0 z-10 hidden items-center justify-between px-6 lg:flex">
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/20">TUNIS / TN</span>
        <a
          href="#projects"
          className="group flex items-center gap-3 px-2 py-2 font-mono text-[10px] tracking-[0.2em] text-white/25 transition-colors hover:text-white/60"
        >
          SCROLL
          <span className="h-px w-10 origin-left bg-white/[0.15] transition-transform duration-500 group-hover:scale-x-150" />
        </a>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/20">2026</span>
      </div>
    </section>
  );
};
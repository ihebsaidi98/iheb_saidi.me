"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef, useState } from "react";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { availability, locationShort } from "@/data/site";
import { useEnvironment } from "@/lib/environment";

type HeroSceneCapability = {
  pointerFine: boolean;
  webgl: boolean;
  saveData: boolean;
  enabled: boolean;
};

let hasLoggedHeroSceneCapability = false;

function getHeroSceneCapability(webglCapable = false): HeroSceneCapability {
  const pointerFine = window.matchMedia("(pointer: fine)").matches;
  const hoverable = window.matchMedia("(hover: hover)").matches;
  const wideViewport = window.matchMedia("(min-width: 1024px)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection?.saveData === true;

  const webgl = webglCapable;

  // Touchscreen laptops may report a coarse primary pointer even when they are
  // capable of hover; the large-viewport + hover fallback keeps the 3D scene on
  // desktop-class displays without permitting phones/tablets to run the heavy hero.
  const enabled =
    (pointerFine || (hoverable && wideViewport)) && webgl && !saveData && !prefersReducedMotion;

  return { pointerFine, webgl, saveData, enabled };
}

function StaticHeroScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 overflow-hidden bg-[#04070c]">
        <div className="absolute left-[62%] top-[42%] size-[42vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]" />
        <div className="absolute left-[62%] top-[42%] size-[26vw] max-w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/10" />
        <div className="absolute left-[62%] top-[42%] size-[16vw] max-w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/[0.07]" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#04070c] to-transparent" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_66%_42%,transparent_8%,rgba(4,7,12,0.25)_50%,rgba(4,7,12,0.85)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[#04070c] via-[#04070c]/80 to-transparent lg:w-[48%]" />
    </div>
  );
}

const HeroScene3D = dynamic(() => import("@/components/HeroScene3D"), {
  ssr: false,
  loading: () => <StaticHeroScene />,
});

/* ================= DATA ================= */

const ROLES = [
  "scalable Spring Boot backends",
  "reactive Angular frontends",
  "production-grade REST APIs",
  "clean, maintainable architecture",
];

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

/*
 * The terminal types the code in over time. Without reserved space the
 * <pre> grows line by line and the vertically-centred hero grid reflows
 * underneath it (reproducible CLS regression on desktop). Reserving the
 * full height of the final snippet keeps the layout stable from the
 * first paint.
 *
 * 24px = `leading-6` (1.5rem) per line, 32px = `py-4` (1rem top+bottom).
 */
const TYPED_CODE_LINES = TYPED_CODE.split("\n").length;
const TYPED_CODE_HEIGHT = TYPED_CODE_LINES * 24 + 32;

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
      aria-hidden="true"
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
    <div
      aria-hidden="true"
      className="hero-card-shell relative w-full max-w-[340px] justify-self-end lg:justify-self-end"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[1.8rem] bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.2),transparent_62%)] blur-3xl" />
      <FloatingYearBadge />
      <div className="hero-code-card relative w-full overflow-hidden rounded-[1.5rem] border border-emerald-300/20 bg-[#050c12]/90 shadow-[0_0_0_1px_rgba(110,231,183,0.08),0_30px_90px_rgba(2,8,16,0.86),0_0_60px_rgba(16,185,129,0.14)] backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#09131a]/90 px-3 py-2.5 sm:px-4">
          <span className="size-2.5 rounded-full bg-[#ff5f57]/80 shadow-[0_0_14px_rgba(255,95,87,0.45)]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/80 shadow-[0_0_14px_rgba(254,188,46,0.45)]" />
          <span className="size-2.5 rounded-full bg-[#28c840]/80 shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
          <span className="ml-3 truncate font-mono text-[9px] tracking-[0.18em] text-white/55 sm:text-[10px]">
            OpportunityController.java
          </span>
          <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.18em] text-white/40 sm:text-[9px]">
            UTF-8
          </span>
        </div>

        <div className="relative bg-[#060d13]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,13,19,0.12),rgba(6,13,19,0.64))]" />
          <pre className="hero-terminal-code relative m-0 w-full overflow-x-auto overflow-y-auto bg-transparent px-3 py-4 font-mono text-[9px] leading-5 text-white/80 sm:px-4 sm:text-[10px] sm:leading-6 md:text-[11px] lg:text-[12px]">
            <code className="relative block min-w-0 w-full max-w-full whitespace-pre text-inherit sm:min-w-0">
              <TypedCode len={len} />
            </code>
            <span className="hero-caret relative ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] bg-emerald-300/90 animate-[hero-caret_1.1s_steps(1)_infinite]" />
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.08] bg-[#081118]/95 px-3 py-2.5 font-mono text-[9px] text-white/60 sm:px-4 sm:text-[10px]">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-emerald-200/80">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            build: success
          </span>
          <span className="whitespace-nowrap text-white/70">tests: 42/42</span>
          <span className="ml-auto whitespace-nowrap text-emerald-300/80">ready to ship</span>
        </div>
      </div>
    </div>
  );
}

function FloatingYearBadge() {
  return (
    <div className="hero-year-badge pointer-events-none absolute right-4 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-300/40 bg-[#061219]/95 shadow-[0_0_0_1px_rgba(6,18,25,0.5),0_20px_45px_rgba(16,185,129,0.12)] backdrop-blur-sm sm:right-5 sm:h-16 sm:w-16 md:right-6 lg:right-10 lg:h-20 lg:w-20">
      <span className="font-mono text-[0.54rem] tracking-[0.22em] text-emerald-100/90 sm:text-[0.58rem] lg:text-[0.7rem]">
        2026
      </span>
    </div>
  );
}

/* ================= SECTION ================= */

export const HeroSection = () => {
  const env = useEnvironment();
  const contentRef = useRef<HTMLDivElement>(null);

  const [loadScene, setLoadScene] = useState(false);

  useEffect(() => {
    const capability = getHeroSceneCapability(env.webgl);
    if (process.env.NODE_ENV !== "production" && !hasLoggedHeroSceneCapability) {
      console.info("[hero-3d] capability", capability);
      hasLoggedHeroSceneCapability = true;
    }
    setLoadScene(capability.enabled);
  }, [env.webgl]);

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
      {loadScene ? <HeroScene3D /> : <StaticHeroScene />}

      <div className="container relative z-10 mx-auto flex h-full w-full items-center px-6 py-16 lg:py-12">
        <div
          ref={contentRef}
          className="relative grid w-full items-center gap-10 sm:gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14"
        >
          {/* LEFT */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <StatusDot size={8} className="shrink-0" />
              <span className="font-mono text-[9px] font-medium tracking-[0.22em] text-emerald-200/70">
                {availability}
              </span>
            </div>

            {/* aria-label on h1: screen readers get the sentence, not letter-by-letter */}
            <h1
              aria-label="Iheb Saidi, full-stack software engineer"
              className="mt-5 font-serif text-[clamp(3rem,12vmin,8rem)] leading-[0.85] tracking-[-0.06em]"
            >
              {/* A11y audit: visual letters are decorative animation layers; the accessible heading is provided separately to avoid single-character false positives. */}
              <span aria-hidden="true" className="inline-block text-balance">
                <LetterReveal text="Iheb" delay={0.15} />
                <br />
                <LetterReveal text="Saidi." delay={0.5} gradient />
              </span>
              <span className="sr-only">Iheb Saidi, full-stack software engineer</span>
            </h1>

            {/* min-h reserves space for the longest role string so the vertically-centered
                hero content does not shift as the typewriter cycles through shorter
                words. Without it the grid grows 1->2 lines and every element below
                the centered content reflows (reproducible CLS regression at 412px). */}
            <p className="mt-4 min-h-[3lh] font-mono text-sm text-white/50 sm:min-h-[2lh] sm:text-base">
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
              Think deeply. Build simply. Ship reliably.
            </p>



            <div className="mt-6 flex flex-wrap items-center gap-6">
              <Button
                href="#projects"
                variant="primary"
                size="md"
              >
                View my work
                <ArrowDown
                  aria-hidden="true"
                  className="size-4 rotate-[-45deg] transition-transform duration-300 group-hover:translate-x-1"
                />
              </Button>
              <Button
                href="#contact"
                variant="ghost"
                size="md"
              >
                Get in touch
              </Button>
            </div>

          </div>

          {/* RIGHT — terminal (aria-hidden, pure decoration) */}
          <TerminalCard />
        </div>
      </div>

      <div className="hero-scroll-hint absolute bottom-7 left-0 right-0 z-10 hidden items-center justify-between px-6 lg:flex">
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">
          {locationShort.toUpperCase().replace(", ", " / ")}
        </span>
        <a
          href="#projects"
          className="group flex items-center gap-3 px-2 py-2 font-mono text-[10px] tracking-[0.2em] text-white/50 transition-colors hover:text-white/80"
        >
          SCROLL
          <span className="h-px w-10 origin-left bg-white/[0.15] transition-transform duration-500 group-hover:scale-x-150" />
        </a>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">2026</span>
      </div>
    </section>
  );
};

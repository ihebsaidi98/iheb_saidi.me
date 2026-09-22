"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { Chip } from "@/components/ui/Chip";
import { SectionShell } from "@/components/ui/SectionShell";
import { useCountUp } from "@/hooks/useCountUp";
import { useLocalTime } from "@/hooks/useLocalTime";
import { profile } from "@/data/profile";

// DATA FIELDS USED: profile.name, profile.title, profile.email, profile.location?, profile.stats
// Keeps your existing Globe. If your dynamic import lives elsewhere, adjust the path.

const Globe = dynamic(
  () => import("@/components/Globe").then((m) => m.Globe),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="aspect-square w-full max-w-[280px] animate-pulse rounded-full bg-emerald-300/[.05] blur-2xl"
      />
    ),
  },
);

/* Skill matrix — edit freely */
const SKILL_GROUPS = [
  {
    label: "Backend",
    skills: [
      { name: "Java / Spring Boot", level: 95 },
      { name: "REST APIs / Microservices", level: 90 },
      { name: "PostgreSQL / Redis", level: 85 },
    ],
  },
  {
    label: "Frontend",
    skills: [
      { name: "Angular / RxJS", level: 90 },
      { name: "TypeScript", level: 88 },
      { name: "Tailwind CSS", level: 85 },
    ],
  },
  {
    label: "DevOps & Cloud",
    skills: [
      { name: "Docker / CI-CD", level: 82 },
      { name: "AWS", level: 75 },
      { name: "Observability", level: 70 },
    ],
  },
];

/* Highlighted mono keywords inside the narrative */
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-emerald-300/85">{children}</span>;
}

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { ref, value: displayed } = useCountUp(value);
  return (
    <div>
      <div className="font-serif text-2xl tracking-[-0.04em] text-white sm:text-3xl">
        <span ref={ref} className="tabular-nums">
          {displayed}
          {suffix}
        </span>
      </div>
      <div className="mt-1 max-w-[110px] text-[11px] leading-4 text-white/30">{label}</div>
    </div>
  );
}

function SkillBar({ name, level }: { name: string; level: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-white/70">{name}</span>
        <span className="font-mono text-[10px] text-white/30 tabular-nums">{level}%</span>
      </div>
      <div className="mt-2 h-px bg-white/[0.08]">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: level / 100 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
          className="h-full origin-left bg-gradient-to-r from-emerald-300/70 to-cyan-400/50"
        />
      </div>
    </div>
  );
}

function IdentityCard() {
  const time = useLocalTime();
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const details: [string, string][] = [
    ["location", profile.location ?? "Tunis, TN"],
    ["local_time", time],
    ["email", profile.email],
    ["timezone", "GMT+1"],
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-4">
        {/* Swap for a real photo: <Image src={portrait} ... /> inside this box */}
        <div
          aria-hidden
          className="grid size-16 place-items-center rounded-xl bg-gradient-to-br from-emerald-300/20 to-cyan-400/10 font-serif text-xl text-emerald-200"
        >
          {initials}
        </div>
        <div>
          <div className="font-serif text-xl text-white">{profile.name}</div>
          <div className="mt-0.5 font-mono text-[10px] tracking-wider text-white/40">
            {profile.title}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[9px] tracking-[0.18em] text-emerald-200/70">
              OPEN TO WORK
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-white/[0.07] pt-5 font-mono text-[11px]">
        {details.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-white/30">{k}</dt>
            <dd className="truncate text-white/60 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex justify-center">
        <Globe />
      </div>
      <p className="mt-2 text-center font-mono text-[9px] tracking-[0.2em] text-white/25">
        36.8065° N, 10.1815° E
      </p>
    </div>
  );
}

export function AboutSection() {
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
      <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
        <IdentityCard />

        <div>
          {/* ← Replace with your real bio; keep <Mono> around key terms */}
          <div className="space-y-4 text-pretty text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
            <p>
              I&apos;m a full-stack engineer focused on <Mono>Spring Boot</Mono> backends
              and <Mono>Angular</Mono> frontends — the unglamorous middle where business
              logic, data integrity, and user experience actually meet.
            </p>
            <p>
              I care about <Mono>clean architecture</Mono>, observable systems, and code
              the next engineer thanks me for. Lately I&apos;ve been deepening my work
              with <Mono>event-driven microservices</Mono> and AI-assisted tooling.
            </p>
          </div>

          {profile.stats?.length > 0 && (
            <div className="mt-10 grid max-w-md grid-cols-3 border-t border-white/[0.08] pt-5">
              {profile.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={i > 0 ? "border-l border-white/[0.08] pl-5" : ""}
                >
                  <Stat value={stat.value} suffix={stat.suffix} label={stat.label} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {SKILL_GROUPS.map((group) => (
              <div key={group.label}>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                  {group.label}
                </h3>
                <div className="mt-4 space-y-5">
                  {group.skills.map((s) => (
                    <SkillBar key={s.name} name={s.name} level={s.level} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
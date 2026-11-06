/**
 * src/sections/InterviewSimulator.tsx
 *
 * Mixed-Format Technical Interview Simulator section.
 *
 * Tracks:
 *   - 4 Tracks: Full Stack, Backend, Frontend, AI/ML
 *   - 10 Questions: 5 Multiple Choice + 5 Open-Ended, progressing from easy to hardest
 *   - Blind Submission: No scores or correctness revealed during the test
 *   - Full Results Report: Score / 100, MCQ breakdown with explanations,
 *     written rubrics, topic breakdown, verified documentation sources
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Announcer } from "@/components/ui/Announcer";
import { SectionShell } from "@/components/ui/SectionShell";
import { StatusDot } from "@/components/ui/StatusDot";
import { useA11yMode } from "@/components/MotionProvider";
import {
  useInterview,
  type InterviewTrack,
  type InterviewQuestion,
  type SessionCompletionReport,
  type MCQResult,
  type WrittenResult,
} from "@/hooks/useInterview";

// ============================================================
// CONSTANTS & DESIGN TOKENS
// ============================================================

const TRACK_OPTIONS: {
  value: InterviewTrack;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    value: "full_stack",
    label: "Full Stack",
    icon: "⚡",
    desc: "Next.js, Node.js, TypeScript, PostgreSQL, architecture",
  },
  {
    value: "backend",
    label: "Backend",
    icon: "🏗️",
    desc: "Distributed systems, TCP/HTTP, messaging, caching, databases",
  },
  {
    value: "frontend",
    label: "Frontend",
    icon: "🎨",
    desc: "React, CSS, JavaScript event loop, performance, accessibility",
  },
  {
    value: "ai_ml",
    label: "AI / ML",
    icon: "🧠",
    desc: "Embeddings, RAG, Transformers, prompt engineering, LLM scaling",
  },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function trackLabel(t: InterviewTrack): string {
  return TRACK_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function ScoreBar({
  label,
  value,
  max = 5.0,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-sky-400" : "bg-amber-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-white/50">{label}</span>
        <span className="font-mono text-2xs text-text-secondary">
          {value.toFixed(1)} / {max.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: EASE }}
          className={twMerge("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

// ============================================================
// SETUP SCREEN
// ============================================================

function SetupScreen({
  onStart,
  isStarting,
}: {
  onStart: (track: InterviewTrack, focusAreas: string[]) => void;
  isStarting: boolean;
}) {
  const [track, setTrack] = useState<InterviewTrack>("full_stack");
  const [focusInput, setFocusInput] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const setupLegendRef = useRef<HTMLLegendElement>(null);

  useEffect(() => {
    setupLegendRef.current?.focus();
  }, []);

  const addFocusArea = () => {
    const val = focusInput.trim();
    if (!val || focusAreas.length >= 10 || val.length > 50) return;
    if (focusAreas.includes(val)) return;
    setFocusAreas((prev) => [...prev, val]);
    setFocusInput("");
  };

  const removeFocusArea = (area: string) => {
    setFocusAreas((prev) => prev.filter((a) => a !== area));
  };

  return (
    <div className="space-y-8">
      {/* Track selector */}
      <fieldset>
        <legend
          ref={setupLegendRef}
          tabIndex={-1}
          className="mb-4 font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary focus:outline-none"
        >
          Select Specialization Track
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRACK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTrack(opt.value)}
              aria-pressed={track === opt.value}
              aria-label={`${opt.label} track: ${opt.desc}`}
              className={twMerge(
                "relative flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                track === opt.value
                  ? "border-emerald-400/30 bg-emerald-400/[0.06] shadow-[0_0_20px_rgba(52,211,153,0.06)]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
              )}
            >
              <span className="text-xl" aria-hidden>
                {opt.icon}
              </span>
              <span className="text-sm font-medium text-white/85">{opt.label}</span>
              <span className="text-2xs leading-relaxed text-text-tertiary">{opt.desc}</span>
              {track === opt.value && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Format overview badge card */}
      <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/10 font-mono text-emerald-300">
            10
          </span>
          <span className="text-white/60">Questions (5 MCQ + 5 Written)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-400/10 font-mono text-sky-300">
            🔒
          </span>
          <span className="text-white/60">Blind test — scores at the end</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-400/10 font-mono text-violet-300">
            📚
          </span>
          <span className="text-white/60">Verified documentation sources</span>
        </div>
      </div>

      {/* Focus areas */}
      <div>
        <label
          htmlFor="focus-input"
          className="mb-4 block font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary"
        >
          Specific Topics of Interest
          <span className="ml-2 text-text-tertiary">(optional, max 10)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="focus-input"
            type="text"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFocusArea();
              }
            }}
            disabled={focusAreas.length >= 10}
            placeholder="e.g. Caching, HTTP/2, Docker, WebSockets…"
            maxLength={50}
            className={twMerge(
              "flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5",
              "font-mono text-sm text-text-secondary placeholder:text-white/20",
              "focus:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/20",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          />
          <button
            type="button"
            onClick={addFocusArea}
            disabled={!focusInput.trim() || focusAreas.length >= 10}
            aria-label="Add topic of interest"
            className={twMerge(
              "rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5",
              "text-xs font-medium text-white/50 transition-all duration-200",
              "hover:border-white/20 hover:text-text-secondary",
              "disabled:cursor-not-allowed disabled:opacity-30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            )}
          >
            Add
          </button>
        </div>
        {focusAreas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-2xs text-white/60"
              >
                {area}
                <button
                  type="button"
                  onClick={() => removeFocusArea(area)}
                  aria-label={`Remove topic ${area}`}
                  className="rounded text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        type="button"
        onClick={() => onStart(track, focusAreas)}
        disabled={isStarting}
        className={twMerge(
          "relative w-full rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-6 py-3.5",
          "text-sm font-medium text-emerald-300 transition-all duration-200",
          "hover:border-emerald-400/40 hover:bg-emerald-400/[0.11] hover:shadow-[0_0_24px_rgba(52,211,153,0.08)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isStarting ? (
          <span className="flex items-center justify-center gap-2.5">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
            />
            Initializing 10-Question Session…
          </span>
        ) : (
          "Start 10-Question Interview →"
        )}
      </button>
    </div>
  );
}

// ============================================================
// QUESTION & ANSWER COMPONENT
// ============================================================

function ActiveQuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  question: InterviewQuestion;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answer: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [writtenAnswer, setWrittenAnswer] = useState<string>("");
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    questionHeadingRef.current?.focus();
  }, [question.question_id]);

  const isMCQ = question.question_type === "mcq";
  const progressPct = ((questionNumber - 1) / totalQuestions) * 100;
  const currentAnswer = isMCQ ? selectedOption : writtenAnswer;
  const canSubmit = isMCQ
    ? selectedOption.length > 0
    : writtenAnswer.trim().length >= 1;

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) return;
    onSubmit(currentAnswer);
  };

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-text-tertiary">
          <span>
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-2xs text-white/60">
            {isMCQ ? "Multiple Choice" : "Written Answer"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={questionNumber}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-label={`Question ${questionNumber} of ${totalQuestions}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        >
          <motion.div
            initial={{ width: `${progressPct}%` }}
            animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            transition={{ duration: 0.4, ease: EASE }}
            className="h-full rounded-full bg-emerald-400"
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-2xs font-mono text-text-tertiary">
          <span className="uppercase tracking-widest text-emerald-300/80">
            {question.topic}
          </span>
          <span aria-hidden>·</span>
          <span className="uppercase tracking-widest">
            {trackLabel(question.track)}
          </span>
        </div>

        <h3
          ref={questionHeadingRef}
          tabIndex={-1}
          className="mt-3 text-base font-medium leading-7 text-text-primary sm:text-[17px] focus:outline-none"
        >
          {question.question_text}
        </h3>
      </div>

      {/* Answer Input */}
      {isMCQ && question.options ? (
        <fieldset className="space-y-2.5">
          <legend className="mb-2 font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary">
            Select one option
          </legend>
          <div className="grid gap-2.5">
            {question.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedOption === option;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedOption(option)}
                  disabled={isSubmitting}
                  aria-pressed={isSelected}
                  aria-label={`Option ${letter}: ${option}`}
                  className={twMerge(
                    "flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-400/[0.08] shadow-[0_0_16px_rgba(52,211,153,0.06)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                    isSubmitting && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    className={twMerge(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold",
                      isSelected
                        ? "bg-emerald-400 text-black"
                        : "border border-white/15 bg-white/[0.04] text-white/60",
                    )}
                  >
                    {letter}
                  </span>
                  <span className="text-sm leading-relaxed text-white/85">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="space-y-3">
          <label
            htmlFor="written-answer"
            className="block font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary"
          >
            Your Technical Answer
          </label>
          <textarea
            id="written-answer"
            value={writtenAnswer}
            onChange={(e) => setWrittenAnswer(e.target.value)}
            disabled={isSubmitting}
            rows={7}
            aria-describedby="char-count"
            placeholder="Explain your technical approach, trade-offs, architecture decisions, and implementation details…"
            maxLength={3000}
            className={twMerge(
              "w-full resize-y rounded-xl border border-white/10 bg-white/[0.02] p-4",
              "font-sans text-sm leading-relaxed text-text-secondary placeholder:text-white/20",
              "transition-all duration-200",
              "focus:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <div id="char-count" className="flex justify-end font-mono text-2xs text-text-tertiary">
            {writtenAnswer.length} / 3000 chars
          </div>
        </div>
      )}

      {/* Blind submission notice */}
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3.5 py-2 text-2xs text-text-tertiary">
        <span aria-hidden>🔒</span>
        <span>
          Blind submission: Answers are saved blindly. Scores and full explanations
          are revealed at the end of all 10 questions.
        </span>
      </div>

      {/* Error message */}
      {errorMessage && (
        <p role="alert" className="text-xs font-medium text-red-400/80">
          {errorMessage}
        </p>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        className={twMerge(
          "w-full rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-6 py-3.5",
          "text-sm font-medium text-emerald-300 transition-all duration-200",
          "hover:border-emerald-400/40 hover:bg-emerald-400/[0.11]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2.5">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
            />
            Recording answer…
          </span>
        ) : questionNumber === totalQuestions ? (
          "Submit Final Answer & View Evaluation →"
        ) : (
          "Save Answer & Continue →"
        )}
      </button>
    </div>
  );
}

// ============================================================
// COMPLETING SCREEN
// ============================================================

function CompletingScreen() {
  const completingHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    completingHeadingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06]">
        <span
          aria-hidden
          className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
        />
      </div>
      <h3
        ref={completingHeadingRef}
        tabIndex={-1}
        className="mt-5 font-serif text-2xl tracking-tight text-text-primary focus:outline-none"
      >
        Evaluating Interview Performance…
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-tertiary">
        Scoring multiple-choice responses, running rubric evaluation on written
        answers, and compiling your comprehensive results report.
      </p>
    </div>
  );
}

// ============================================================
// COMPREHENSIVE RESULTS REPORT SCREEN
// ============================================================

function CompletedReportScreen({
  report,
  onReset,
}: {
  report: SessionCompletionReport;
  onReset: () => void;
}) {
  const [openMCQ, setOpenMCQ] = useState<number | null>(null);
  const [openWritten, setOpenWritten] = useState<number | null>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    reportHeadingRef.current?.focus();
  }, []);

  const scoreColor =
    report.score_out_of_100 >= 80
      ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/[0.08]"
      : report.score_out_of_100 >= 60
        ? "text-sky-400 border-sky-400/30 bg-sky-400/[0.08]"
        : "text-amber-400 border-amber-400/30 bg-amber-400/[0.08]";

  return (
    <div className="space-y-8">
      {/* Hero Score Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-mono text-2xs uppercase tracking-[0.18em] text-emerald-300">
                Evaluation Complete
              </span>
              <span aria-hidden className="text-white/20">·</span>
              <span className="font-mono text-2xs uppercase tracking-[0.18em] text-text-tertiary">
                {trackLabel(report.track)}
              </span>
            </div>
            <h3
              ref={reportHeadingRef}
              tabIndex={-1}
              className="mt-2 font-serif text-3xl font-medium tracking-tight text-text-primary focus:outline-none"
            >
              Technical Assessment Report
            </h3>
            <p className="mt-1 text-sm text-text-tertiary">
              10-question evaluation across multiple-choice theory and architectural written prompts.
            </p>
          </div>

          {/* Score Badge */}
          <div className="mt-6 flex flex-col items-center sm:mt-0">
            <div
              className={twMerge(
                "flex h-24 w-24 items-center justify-center rounded-2xl border font-mono text-2xl font-bold shadow-lg",
                scoreColor,
              )}
            >
              {report.score_out_of_100.toFixed(0)}
              <span className="text-xs font-normal text-text-tertiary">/100</span>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 border-t border-white/[0.06] pt-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Multiple-Choice Score</span>
              <span className="font-mono text-sm font-semibold text-emerald-300">
                {report.mcq_score.toFixed(1)} / 50.0
              </span>
            </div>
            <p className="mt-1 text-2xs text-text-tertiary">
              5 questions testing factual accuracy and standard specifications.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Written Answer Rubric</span>
              <span className="font-mono text-sm font-semibold text-sky-300">
                {report.written_score.toFixed(1)} / 50.0
              </span>
            </div>
            <p className="mt-1 text-2xs text-text-tertiary">
              5 open-ended questions evaluated for depth, clarity, and trade-offs.
            </p>
          </div>
        </div>
      </div>

      {/* Topic Breakdown */}
      {report.topic_breakdown && report.topic_breakdown.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
          <h4 className="font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary">
            Topic Performance Breakdown
          </h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {report.topic_breakdown.map((t) => (
              <ScoreBar
                key={t.topic}
                label={t.topic}
                value={t.score}
                max={t.max_score}
              />
            ))}
          </div>
        </div>
      )}

      {/* Strengths and Improvements */}
      <div className="grid gap-4 sm:grid-cols-2">
        {report.overall_strengths && report.overall_strengths.length > 0 && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
            <p className="mb-3 font-mono text-2xs uppercase tracking-[0.16em] text-emerald-400/70">
              Key Strengths
            </p>
            <ul className="space-y-2">
              {report.overall_strengths.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-text-secondary">
                  <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-emerald-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.overall_improvements && report.overall_improvements.length > 0 && (
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-5">
            <p className="mb-3 font-mono text-2xs uppercase tracking-[0.16em] text-amber-400/70">
              Areas for Improvement
            </p>
            <ul className="space-y-2">
              {report.overall_improvements.map((a, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-text-secondary">
                  <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-amber-400" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Multiple-Choice Review Section */}
      <div className="space-y-3">
        <h4 className="font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary">
          Part 1: Multiple-Choice Questions (1–5)
        </h4>
        <div className="space-y-2">
          {report.mcq_results.map((mcq, idx) => {
            const isOpen = openMCQ === idx;
            return (
              <div
                key={mcq.question_id}
                className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
              >
                <button
                  type="button"
                  id={`mcq-btn-${mcq.question_id}`}
                  onClick={() => setOpenMCQ(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`mcq-panel-${mcq.question_id}`}
                  aria-label={`Question ${mcq.question_number}: ${mcq.is_correct ? "Correct" : "Incorrect"}. ${isOpen ? "Collapse" : "Expand"} review.`}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={twMerge(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        mcq.is_correct
                           ? "bg-emerald-400/20 text-emerald-300"
                           : "bg-red-400/20 text-red-300",
                      )}
                    >
                      {mcq.is_correct ? "✓" : "✗"}
                    </span>
                    <span className="font-mono text-xs text-text-tertiary">Q{mcq.question_number}</span>
                    <span className="text-xs font-medium text-text-secondary line-clamp-1">
                      {mcq.question_text}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-tertiary">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      id={`mcq-panel-${mcq.question_id}`}
                      role="region"
                      aria-labelledby={`mcq-btn-${mcq.question_id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/[0.05] p-5 space-y-3 bg-white/[0.01]"
                    >
                      <p className="text-sm text-text-primary">{mcq.question_text}</p>
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-text-tertiary">Your Answer:</span>
                          <span
                            className={twMerge(
                              "font-semibold",
                              mcq.is_correct ? "text-emerald-300" : "text-red-300",
                            )}
                          >
                            {mcq.submitted_answer}
                          </span>
                        </div>
                        {!mcq.is_correct && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-tertiary">Correct Answer:</span>
                            <span className="font-semibold text-emerald-300">
                              {mcq.correct_answer}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-white/60">
                        <strong className="text-text-secondary">Explanation: </strong>
                        {mcq.explanation}
                      </div>
                      {mcq.source_url && (
                        <div className="text-2xs text-text-tertiary">
                          Source:{" "}
                          <a
                            href={mcq.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300/80 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded"
                          >
                            {mcq.source_title || mcq.source_url} ↗
                          </a>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Written Answers Review Section */}
      <div className="space-y-3">
        <h4 className="font-mono text-2xs uppercase tracking-[0.16em] text-text-tertiary">
          Part 2: Written Architecture Answers (6–10)
        </h4>
        <div className="space-y-2">
          {report.written_results.map((wr, idx) => {
            const isOpen = openWritten === idx;
            return (
              <div
                key={wr.question_id}
                className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
              >
                <button
                  type="button"
                  id={`written-btn-${wr.question_id}`}
                  onClick={() => setOpenWritten(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`written-panel-${wr.question_id}`}
                  aria-label={`Question ${wr.question_number}: Scored ${wr.rubric.overall_score.toFixed(1)} out of 5.0. ${isOpen ? "Collapse" : "Expand"} review.`}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-2xs text-white/60">
                      {wr.rubric.overall_score.toFixed(1)}/5.0
                    </span>
                    <span className="font-mono text-xs text-text-tertiary">Q{wr.question_number}</span>
                    <span className="text-xs font-medium text-text-secondary line-clamp-1">
                      {wr.question_text}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-tertiary">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      id={`written-panel-${wr.question_id}`}
                      role="region"
                      aria-labelledby={`written-btn-${wr.question_id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/[0.05] p-5 space-y-4 bg-white/[0.01]"
                    >
                      <p className="text-sm font-medium text-text-primary">{wr.question_text}</p>

                      <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <ScoreBar label="Accuracy" value={wr.rubric.accuracy} />
                        <ScoreBar label="Technical Depth" value={wr.rubric.depth} />
                        <ScoreBar label="Clarity" value={wr.rubric.clarity} />
                        <ScoreBar label="Problem-Solving" value={wr.rubric.problem_solving} />
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-tertiary">
                          Your Submitted Answer
                        </span>
                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-text-secondary">
                          {wr.submitted_answer}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-mono text-2xs uppercase tracking-wider text-emerald-400/60">
                          Sample Ideal Architecture Answer
                        </span>
                        <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.03] p-3 text-xs leading-relaxed text-text-secondary">
                          {wr.ideal_answer}
                        </div>
                      </div>

                      {wr.source_url && (
                        <div className="text-2xs text-text-tertiary">
                          Verified Reference:{" "}
                          <a
                            href={wr.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300/80 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded"
                          >
                            {wr.source_title || wr.source_url} ↗
                          </a>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restart CTA */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={onReset}
          className={twMerge(
            "rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-8 py-3.5",
            "text-sm font-medium text-emerald-300 transition-all duration-200",
            "hover:border-emerald-400/40 hover:bg-emerald-400/[0.11]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          )}
        >
          Practice Another Track →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN SECTION EXPORT
// ============================================================

export function InterviewSimulatorSection() {
  const a11yMode = useA11yMode();
  const { state, start, submitAnswer, reset } = useInterview();
  const [announcement, setAnnouncement] = useState("");

  const handleStart = (track: InterviewTrack, focus_areas: string[]) => {
    start({ track, focus_areas });
  };

  useEffect(() => {
    switch (state.phase) {
      case "starting":
        setAnnouncement("Initializing technical assessment session…");
        break;
      case "question_active":
        if (state.currentQuestion) {
          const typeLabel =
            state.currentQuestion.question_type === "mcq"
              ? "Multiple-choice question"
              : "Written architecture question";
          setAnnouncement(
            `Question ${state.questionNumber} of ${state.totalQuestions}: ${trackLabel(state.currentQuestion.track)} track. Topic: ${state.currentQuestion.topic}. ${typeLabel}.`
          );
        }
        break;
      case "submitting":
        setAnnouncement(
          `Recording answer for question ${state.questionNumber} of ${state.totalQuestions}…`
        );
        break;
      case "completing":
        setAnnouncement(
          "All 10 questions answered. Evaluating technical performance and compiling assessment report…"
        );
        break;
      case "completed":
        if (state.completionReport) {
          setAnnouncement(
            `Technical evaluation complete. Final assessment score: ${state.completionReport.score_out_of_100.toFixed(0)} out of 100.`
          );
        }
        break;
      case "error":
        if (state.errorMessage) {
          setAnnouncement(`Assessment error: ${state.errorMessage}`);
        }
        break;
      default:
        break;
    }
  }, [
    state.phase,
    state.questionNumber,
    state.totalQuestions,
    state.currentQuestion,
    state.completionReport,
    state.errorMessage,
  ]);

  return (
    <SectionShell
      id="interview"
      label="interview simulator"
      title={["Practice technical", "interviews."]}
      intro="10-question mixed-format technical assessment across 4 tracks: Full Stack, Backend, Frontend, and AI/ML. Sourced from official web specifications and documentation."
    >
      <Announcer message={announcement} politeness={state.phase === "error" ? "assertive" : "polite"} />

      <motion.div
        initial={a11yMode ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative"
      >
        {/* Session indicator bar */}
        {state.phase !== "idle" && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              {state.phase === "starting" ||
              state.phase === "submitting" ||
              state.phase === "completing" ? (
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 animate-spin rounded-full border border-emerald-400/30 border-t-emerald-400"
                />
              ) : (
                <StatusDot size={6} className="shrink-0" />
              )}
              <span className="font-mono text-2xs uppercase tracking-[0.18em] text-emerald-200/60">
                {state.phase === "starting"
                  ? "Initializing"
                  : state.phase === "completing"
                    ? "Evaluating"
                    : state.phase === "completed"
                      ? "Complete"
                      : "Live Session"}
              </span>
            </span>

            {state.config && (
              <>
                <span aria-hidden className="h-px w-4 bg-white/[0.08]" />
                <span className="font-mono text-2xs text-white/50">
                  {trackLabel(state.config.track)}
                </span>
              </>
            )}

            {state.questionNumber > 0 && state.phase !== "completed" && (
              <>
                <span aria-hidden className="h-px w-4 bg-white/[0.08]" />
                <span className="font-mono text-2xs text-text-tertiary">
                  Q{state.questionNumber} / {state.totalQuestions}
                </span>
              </>
            )}

            <button
              type="button"
              onClick={reset}
              className="ml-auto rounded-full border border-white/[0.07] px-3 py-1 font-mono text-2xs text-text-tertiary transition-colors hover:border-white/15 hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Start Again
            </button>
          </div>
        )}

        {/* Global Error banner */}
        {state.errorMessage && state.phase === "error" && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4"
          >
            <span aria-hidden className="mt-0.5 text-red-400/70">⚠</span>
            <div className="flex-1">
              <p className="text-sm text-red-300/80">{state.errorMessage}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-2 text-xs text-text-tertiary underline underline-offset-2 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
              >
                Go back
              </button>
            </div>
          </div>
        )}

        {/* Phase Transitions */}
        <AnimatePresence mode="wait">
          {(state.phase === "idle" ||
            state.phase === "starting" ||
            state.phase === "error") && (
            <motion.div
              key="setup"
              initial={a11yMode ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SetupScreen
                onStart={handleStart}
                isStarting={state.phase === "starting"}
              />
            </motion.div>
          )}

          {(state.phase === "question_active" ||
            state.phase === "submitting") &&
            state.currentQuestion && (
              <motion.div
                key={`q-${state.currentQuestion.question_id}`}
                initial={a11yMode ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveQuestionCard
                  question={state.currentQuestion}
                  questionNumber={state.questionNumber}
                  totalQuestions={state.totalQuestions}
                  onSubmit={submitAnswer}
                  isSubmitting={state.phase === "submitting"}
                  errorMessage={state.errorMessage}
                />
              </motion.div>
            )}

          {state.phase === "completing" && (
            <motion.div
              key="completing"
              initial={a11yMode ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CompletingScreen />
            </motion.div>
          )}

          {state.phase === "completed" && state.completionReport && (
            <motion.div
              key="completed"
              initial={a11yMode ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CompletedReportScreen
                report={state.completionReport}
                onReset={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </SectionShell>
  );
}

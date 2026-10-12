/**
 * src/components/chat/ChatWidget.tsx
 *
 * Floating chat widget — FAB + expandable panel.
 *
 * Features:
 *   - Floating action button (bottom-right, z-50)
 *   - Expandable panel with framer-motion spring animation
 *   - Welcome screen with suggested questions
 *   - Conversation history with user + assistant bubbles
 *   - Loading skeleton while awaiting LLM response
 *   - Error banner with retry button
 *   - Source link chips below assistant messages
 *   - Input with send-on-Enter, character count, disabled while loading
 *   - Keyboard: Escape closes, Tab cycles within panel (focus trap)
 *   - ARIA: role="dialog", aria-modal, aria-label, aria-live="polite"
 *   - Respects prefers-reduced-motion via MotionConfig in MotionProvider
 *   - Calls ONLY /api/chat — never the LLM provider directly
 */

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useChat } from "@/hooks/useChat";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";

// ============================================================
// CONSTANTS
// ============================================================

const MAX_INPUT = 500;

const SUGGESTED = [
  "What technologies does Iheb work with?",
  "Tell me about Iheb's professional experience.",
  "What projects has Iheb built?",
  "How can I contact Iheb?",
];

const PANEL_SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };
const BUBBLE_SPRING = { type: "spring" as const, stiffness: 280, damping: 26, mass: 0.7 };

// ============================================================
// ICONS — inline SVG, no extra dep
// ============================================================

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 4V5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M1 6.5A5.5 5.5 0 0110.5 2L12 3.5M12 6.5A5.5 5.5 0 012.5 11L1 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconBot() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <rect x="1" y="4" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4.5 4V2.5a2 2 0 013 0V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="4.5" cy="8" r="1" fill="currentColor"/>
      <circle cx="8.5" cy="8" r="1" fill="currentColor"/>
    </svg>
  );
}
function IconClear() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2 6.5h9M6.5 2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transform: "rotate(45deg)", transformOrigin: "center" }} />
      <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ============================================================
// LOADING SKELETON
// ============================================================
function BubbleSkeleton() {
  return (
    <div className="flex items-start gap-2.5" aria-hidden>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400/60">
        <IconBot />
      </div>
      <div className="max-w-[85%] space-y-2 pt-0.5">
        <div className="h-3 w-40 animate-pulse rounded-full bg-white/8" />
        <div className="h-3 w-56 animate-pulse rounded-full bg-white/8" />
        <div className="h-3 w-28 animate-pulse rounded-full bg-white/8" />
      </div>
    </div>
  );
}

// ============================================================
// MAIN WIDGET
// ============================================================
export function ChatWidget() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { state, send, retry, clear } = useChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const isLoading = state.status === "loading";
  const hasMessages = state.messages.length > 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  // Escape key closes panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus trap inside the dialog
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const focusable = (): HTMLElement[] =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && !el.closest('[aria-hidden="true"]'));

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    panel.addEventListener("keydown", handler);
    return () => panel.removeEventListener("keydown", handler);
  }, [open]);

  const handleSend = useCallback(
    (text?: string) => {
      const q = (text ?? input).trim();
      if (!q || isLoading) return;
      setInput("");
      void send(q);
    },
    [input, isLoading, send],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* ---- FAB ---- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={PANEL_SPRING}
              className={twMerge(
                "flex flex-col",
                "w-[min(calc(100vw-3rem),420px)] h-[min(calc(100vh-8rem),640px)]",
                "overflow-hidden rounded-2xl",
                "border border-white/8",
                "bg-[#0a0f14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
                "backdrop-blur-2xl",
              )}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
                  <IconBot />
                </span>
                <div className="min-w-0 flex-1">
                  <p id={titleId} className="text-xs font-semibold text-white">
                    Ask about Iheb
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-white/40">
                    Answers from portfolio data
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {hasMessages && (
                    <button
                      onClick={clear}
                      title="Clear conversation"
                      aria-label="Clear conversation"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/6 hover:text-white/70"
                    >
                      <IconClear />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/6 hover:text-white/70"
                  >
                    <IconClose />
                  </button>
                </div>
              </div>

              {/* Message list */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
              >
                {/* Welcome screen */}
                {!hasMessages && (
                  <WelcomeScreen onSelect={(q) => handleSend(q)} disabled={isLoading} />
                )}

                {/* Messages */}
                <div className="space-y-4">
                  {state.messages.map((msg) => (
                    <AnimatePresence key={msg.id} mode="wait">
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={BUBBLE_SPRING}
                      >
                        {msg.pending ? (
                          <BubbleSkeleton />
                        ) : msg.role === "user" ? (
                          <UserBubble content={msg.content} />
                        ) : (
                          <AssistantBubble
                            content={msg.content}
                            sources={msg.sources}
                            failed={msg.failed}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  ))}
                </div>

                {/* Error banner */}
                {state.status === "error" && state.errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-400/15 bg-red-400/[0.07] px-3.5 py-3"
                    role="alert"
                  >
                    <span className="mt-px shrink-0 text-red-400/80 text-sm" aria-hidden>⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.78rem] leading-snug text-red-300/80">
                        {state.errorMessage}
                      </p>
                      {state.lastQuestion && (
                        <button
                          onClick={retry}
                          className="mt-2 flex items-center gap-1.5 text-[0.72rem] font-medium text-red-300/70 transition-colors hover:text-red-300"
                        >
                          <IconRefresh />
                          Retry
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                <div ref={bottomRef} aria-hidden />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
                <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors focus-within:border-emerald-400/25 focus-within:bg-white/[0.06]">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about Iheb…"
                    rows={1}
                    disabled={isLoading}
                    aria-label="Chat message"
                    aria-describedby="chat-input-hint"
                    className={twMerge(
                      "flex-1 resize-none bg-transparent text-[0.825rem] leading-relaxed",
                      "text-white placeholder:text-white/30",
                      "outline-none scrollbar-none",
                      "max-h-28 min-h-[1.4rem]",
                      isLoading && "opacity-50",
                    )}
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className={twMerge(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      "transition-all duration-200",
                      input.trim() && !isLoading
                        ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                        : "text-white/20",
                    )}
                  >
                    <IconSend />
                  </button>
                </div>
                <p id="chat-input-hint" className="mt-1.5 px-1 font-mono text-[9px] text-white/25">
                  {input.length > 0
                    ? `${MAX_INPUT - input.length} chars remaining · Shift+Enter for new line`
                    : "Enter to send · answers from verified portfolio data only"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <motion.button
          ref={fabRef}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close chat" : "Open portfolio chatbot"}
          aria-expanded={open}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
          className={twMerge(
            "relative flex h-14 w-14 items-center justify-center",
            "rounded-full border text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
            "transition-colors duration-300",
            open
              ? "border-white/20 bg-[#0d141b]"
              : "border-emerald-400/30 bg-emerald-400/10 hover:border-emerald-400/50 hover:bg-emerald-400/15",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <IconClose />
              </motion.span>
            ) : (
              <motion.span
                key="chat"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <IconChat />
              </motion.span>
            )}
          </AnimatePresence>
          {/* Unread dot when there's an error and panel is closed */}
          {!open && state.status === "error" && (
            <span
              aria-label="Chat error"
              className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#0a0f14] bg-red-400"
            />
          )}
        </motion.button>
      </div>
    </>
  );
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function WelcomeScreen({
  onSelect,
  disabled = false,
}: {
  onSelect: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 text-2xl">
        <IconBot />
      </span>
      <p className="mt-3 text-center text-[0.85rem] font-medium text-white">
        Ask about Iheb&apos;s work
      </p>
      <p className="mt-1.5 max-w-[260px] text-center text-[0.75rem] leading-relaxed text-white/45">
        Answers come only from verified portfolio data — skills, projects, experience, and contact info.
      </p>

      <div className="mt-5 flex w-full flex-col gap-2">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            disabled={disabled}
            onClick={() => onSelect(q)}
            className={twMerge(
              "w-full rounded-xl border border-white/8 px-3.5 py-2.5 text-left",
              "text-[0.78rem] leading-snug text-white/60",
              "transition-all duration-200",
              disabled
                ? "cursor-not-allowed opacity-40"
                : "hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-white/85",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50",
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// BUBBLES
// ============================================================
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className={twMerge(
          "max-w-[82%] rounded-2xl rounded-br-sm",
          "bg-white/[0.07] px-4 py-2.5",
          "text-[0.825rem] leading-relaxed text-white/85",
        )}
      >
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  content,
  sources,
  failed,
}: {
  content: string;
  sources?: import("@/lib/chat").ChatSource[];
  failed?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={twMerge(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          failed
            ? "bg-red-400/10 text-red-400"
            : "bg-emerald-400/10 text-emerald-400/70",
        )}
      >
        <IconBot />
      </span>
      <div className="min-w-0 flex-1">
        {failed ? (
          <p className="text-[0.825rem] italic text-red-300/80">
            Failed to generate response.
          </p>
        ) : (
          <ChatMarkdown content={content} />
        )}
        {sources && sources.length > 0 && (
          <SourceChips sources={sources} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// SOURCE CHIPS
// ============================================================
const TYPE_LABELS: Record<string, string> = {
  profile: "Profile",
  contact: "Contact",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  project: "Project",
  meta: "Meta",
};

function SourceChips({ sources }: { sources: import("@/lib/chat").ChatSource[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Sources">
      {sources.map((s) => (
        <span
          key={s.id}
          title={s.title}
          className={twMerge(
            "inline-flex max-w-[180px] items-center gap-1 truncate",
            "rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5",
            "font-mono text-[0.65rem] text-white/40",
          )}
        >
          <span className="text-emerald-400/50">{TYPE_LABELS[s.type] ?? s.type}</span>
          <span className="truncate">{s.title}</span>
        </span>
      ))}
    </div>
  );
}

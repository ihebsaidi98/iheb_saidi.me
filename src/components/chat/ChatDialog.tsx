/**
 * src/components/chat/ChatDialog.tsx
 *
 * Dynamic chat modal panel — extracted from ChatWidget for hybrid code-splitting (ADR-04).
 * Houses useChat, ChatMarkdown, message list, auto-scrolling, and input management.
 */

"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import type { useChat } from "@/hooks/useChat";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";

// ============================================================
// CONSTANTS
// ============================================================

const MAX_INPUT = 500;
const NEAR_BOTTOM_THRESHOLD_PX = 80;

const SUGGESTED = [
  "What technologies does Iheb work with?",
  "Tell me about Iheb's professional experience.",
  "What projects has Iheb built?",
  "How can I contact Iheb?",
];

const PANEL_SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };
const BUBBLE_SPRING = { type: "spring" as const, stiffness: 300, damping: 28, mass: 0.6 };

// ============================================================
// ICONS
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
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="4.5" width="11" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 4.5V3a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="5" cy="9" r="1.1" fill="currentColor" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.8 8a1 1 0 001 .9h4.4a1 1 0 001-.9l.8-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M10.83 5.17l2.12-2.12M3.05 12.95l2.12-2.12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================
// TYPING INDICATOR
// ============================================================

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5" aria-label="Assistant is thinking" role="status">
      <span
        aria-hidden
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
          bg-gradient-to-br from-emerald-400/20 to-emerald-600/10
          ring-1 ring-emerald-400/25 text-emerald-400"
      >
        <IconBot />
      </span>
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-white/8
          bg-white/[0.04] px-4 py-3.5 mt-0.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-emerald-400/70"
            style={{
              animation: "chatDotBounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
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
    <div className="flex flex-col items-center py-6">
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="absolute h-24 w-24 rounded-full opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(110,231,183,0.35) 0%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
        <span
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl
            bg-gradient-to-br from-emerald-400/20 to-emerald-600/10
            ring-1 ring-emerald-400/30 text-emerald-400
            shadow-[0_0_28px_rgba(110,231,183,0.12)]"
        >
          <svg width="26" height="26" viewBox="0 0 14 14" fill="none" aria-hidden>
            <rect x="1.5" y="4.5" width="11" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 4.5V3a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="5" cy="9" r="1.1" fill="currentColor" />
            <circle cx="9" cy="9" r="1.1" fill="currentColor" />
          </svg>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <span className="text-emerald-400/70"><IconSparkle /></span>
        <p className="text-[0.875rem] font-semibold text-white">Ask about Iheb&apos;s work</p>
      </div>

      <p className="mt-2 max-w-[250px] text-center text-[0.73rem] leading-relaxed text-white/40">
        Powered by verified portfolio data — skills, projects, experience &amp; contact info.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            disabled={disabled}
            onClick={() => onSelect(q)}
            className={twMerge(
              "group w-full rounded-xl border border-white/7 px-3.5 py-2.5 text-left",
              "text-[0.77rem] leading-snug text-white/55 transition-all duration-200",
              disabled
                ? "cursor-not-allowed opacity-35"
                : "hover:border-emerald-400/22 hover:bg-emerald-400/[0.05] hover:text-white/85 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50",
            )}
          >
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-1 w-1 shrink-0 rounded-full bg-emerald-400/50 transition-all duration-200
                  group-hover:bg-emerald-400/90 group-hover:scale-125"
              />
              {q}
            </span>
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
          "max-w-[82%] rounded-2xl rounded-br-none",
          "border border-emerald-400/12",
          "bg-gradient-to-br from-emerald-400/10 to-emerald-500/5",
          "px-4 py-2.5",
          "text-[0.825rem] leading-relaxed text-white/90",
        )}
      >
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  content,
  failed,
}: {
  content: string;
  failed?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={twMerge(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          failed
            ? "bg-red-400/12 text-red-400 ring-1 ring-red-400/25"
            : "bg-gradient-to-br from-emerald-400/18 to-emerald-600/8 text-emerald-400 ring-1 ring-emerald-400/22",
        )}
      >
        <IconBot />
      </span>
      <div className="min-w-0 flex-1">
        {failed ? (
          <p className="text-[0.825rem] italic text-red-300/75">Failed to generate a response.</p>
        ) : (
          <div className="border-l-2 border-emerald-400/15 pl-3">
            <ChatMarkdown content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DIALOG COMPONENT
// ============================================================

export interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ReturnType<typeof useChat>;
}

export function ChatDialog({ isOpen, onClose, chat }: ChatDialogProps) {
  const titleId = useId();
  const [input, setInput] = useState("");
  const { state, send, retry, clear } = chat;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const isLoading = state.status === "loading";
  const hasMessages = state.messages.length > 0;

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    if (isOpen && isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [state.messages, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    const content = contentWrapperRef.current;
    if (!container || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) container.scrollTop = container.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && hasMessages) {
      isNearBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [isOpen, hasMessages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtTop = scrollTop <= 0 && e.deltaY < 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (isAtTop || isAtBottom) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      if (window.innerWidth < 768 && panelRef.current) {
        const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        if (kh > 50) {
          panelRef.current.style.bottom = `${kh}px`;
          panelRef.current.style.height = `${Math.min(vv.height, window.innerHeight * 0.88)}px`;
        } else {
          panelRef.current.style.bottom = "0px";
          panelRef.current.style.height = "88vh";
        }
      }
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = useCallback((text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isLoading) return;
    setInput("");
    isNearBottomRef.current = true;
    scrollToBottom(true);
    void send(q);
  }, [input, isLoading, send, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <>
      <style>{`
        @keyframes chatDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={PANEL_SPRING}
              className={twMerge(
                "fixed z-50 flex flex-col overflow-hidden",
                "inset-x-0 bottom-0 w-full max-w-full rounded-t-3xl",
                "h-[88vh] max-h-[88dvh]",
                "md:inset-auto md:bottom-24 md:right-6 md:w-[430px] md:max-w-[calc(100vw-3rem)]",
                "md:h-[min(calc(100vh-8rem),660px)] md:max-h-[660px] md:rounded-2xl",
                "bg-[#080d12]/98 backdrop-blur-3xl",
                "shadow-[0_32px_80px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.07)]",
              )}
              style={{ height: "min(88dvh, 660px)", maxHeight: "100dvh" }}
            >
              {/* Mobile drag pill */}
              <div className="flex justify-center pt-2.5 pb-0 md:hidden" aria-hidden="true">
                <div className="h-1.5 w-12 rounded-full bg-white/25" />
              </div>

              {/* Emerald gradient top accent line */}
              <div
                className="shrink-0 h-px w-full"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(110,231,183,0.55) 40%, rgba(56,189,248,0.3) 70%, transparent 100%)",
                }}
                aria-hidden="true"
              />

              {/* Header */}
              <div
                className="flex shrink-0 items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]"
                style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.025) 0%, transparent 100%)" }}
              >
                <div className="relative shrink-0">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full
                      bg-gradient-to-br from-emerald-400/20 to-emerald-600/10
                      ring-1 ring-emerald-400/35 text-emerald-400
                      shadow-[0_0_14px_rgba(110,231,183,0.14)]"
                  >
                    <IconBot />
                  </span>
                  <span
                    aria-hidden
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#080d12]"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    id={titleId}
                    className="text-[0.8rem] font-semibold"
                    style={{
                      background: "linear-gradient(90deg, var(--text-primary) 0%, rgba(245,247,250,0.78) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Ask about Iheb
                  </p>
                  <p className="mt-0.5 truncate text-[0.68rem] text-white/38">
                    Powered by portfolio knowledge base
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {hasMessages && (
                    <button
                      onClick={clear}
                      title="Clear conversation"
                      aria-label="Clear conversation"
                      className="flex h-8 w-8 md:h-7 md:w-7 items-center justify-center rounded-lg
                        text-white/28 transition-all duration-200 hover:bg-white/6 hover:text-white/62"
                    >
                      <IconTrash />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    aria-label="Close chat"
                    className="flex h-8 w-8 md:h-7 md:w-7 items-center justify-center rounded-lg
                      text-white/28 transition-all duration-200 hover:bg-white/6 hover:text-white/62"
                  >
                    <IconClose />
                  </button>
                </div>
              </div>

              {/* Scrollable messages */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className={twMerge(
                  "flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-5",
                  "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20",
                )}
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
              >
                <div ref={contentWrapperRef} className="space-y-5">
                  {!hasMessages && (
                    <WelcomeScreen onSelect={(q) => handleSend(q)} disabled={isLoading} />
                  )}

                  {state.messages.map((msg, index) => (
                    <AnimatePresence key={msg.id} mode="wait">
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ ...BUBBLE_SPRING, delay: index === 0 ? 0 : 0.03 }}
                      >
                        {msg.pending ? (
                          <TypingIndicator />
                        ) : msg.role === "user" ? (
                          <UserBubble content={msg.content} />
                        ) : (
                          <AssistantBubble content={msg.content} failed={msg.failed} />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  ))}

                  {state.status === "error" && state.errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-start gap-3 rounded-2xl border border-red-400/18 px-3.5 py-3.5 mt-2"
                      style={{ background: "linear-gradient(135deg, rgba(248,113,113,0.07) 0%, transparent 100%)" }}
                      role="alert"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                          rounded-full bg-red-400/15 text-red-400 text-[10px] font-bold"
                      >
                        ✕
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.78rem] leading-snug text-red-300/80">{state.errorMessage}</p>
                        {state.lastQuestion && (
                          <button
                            onClick={retry}
                            className="mt-2 flex items-center gap-1.5 text-[0.72rem] font-medium
                              text-red-300/60 underline underline-offset-2 decoration-red-300/30
                              transition-colors hover:text-red-300/90"
                          >
                            <IconRefresh />
                            Retry
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Input area */}
              <div
                className="shrink-0 border-t border-white/[0.05] px-3 pt-3"
                style={{
                  paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
                  background: "linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)",
                }}
              >
                <div
                  className={twMerge(
                    "flex items-end gap-2 rounded-2xl border px-3.5 py-2.5 transition-all duration-200",
                    "bg-white/[0.04] border-white/10",
                    "focus-within:border-emerald-400/35 focus-within:bg-white/[0.055]",
                    "focus-within:shadow-[0_0_0_3px_rgba(110,231,183,0.07)]",
                  )}
                >
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
                      "flex-1 resize-none bg-transparent text-base md:text-[0.825rem] leading-relaxed",
                      "text-white/90 placeholder:text-white/28",
                      "outline-none scrollbar-none",
                      "max-h-28 min-h-[1.4rem]",
                      isLoading && "opacity-40",
                    )}
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    aria-label="Send message"
                    className={twMerge(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                      canSend
                        ? "bg-emerald-500/75 text-white hover:bg-emerald-400/90 hover:scale-105 active:scale-95 shadow-[0_2px_10px_rgba(110,231,183,0.22)] hover:shadow-[0_4px_16px_rgba(110,231,183,0.32)]"
                        : "text-white/18 cursor-not-allowed",
                    )}
                  >
                    <IconSend />
                  </button>
                </div>
                <p
                  id="chat-input-hint"
                  className="mt-1.5 flex justify-between px-1 font-mono text-[9px] text-white/22"
                >
                  <span>Enter to send · Shift+Enter for new line</span>
                  {input.length > 0 && (
                    <span className={input.length > MAX_INPUT * 0.9 ? "text-amber-400/60" : ""}>
                      {MAX_INPUT - input.length}
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

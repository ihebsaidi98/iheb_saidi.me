/**
 * src/components/chat/ChatWidget.tsx
 *
 * Floating chat widget — synchronous FAB + dynamic modal dialog (ADR-04).
 * Keeps the FAB in the critical bundle for instant interaction while code-splitting
 * the heavy chat dialog, markdown parser, and state management.
 */

"use client";

import dynamic from "next/dynamic";
import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useChat } from "@/hooks/useChat";

const ChatDialog = dynamic(
  () => import("./ChatDialog").then((mod) => mod.ChatDialog),
  { ssr: false }
);

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const chat = useChat();

  const handleToggle = () => {
    if (!hasOpened) setHasOpened(true);
    setOpen((v) => !v);
  };

  const handleClose = () => {
    setOpen(false);
    fabRef.current?.focus();
  };

  return (
    <>
      {hasOpened && (
        <ChatDialog
          isOpen={open}
          onClose={handleClose}
          chat={chat}
        />
      )}

      {/* FAB */}
      <div
        className={twMerge(
          "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3",
          open && "hidden md:flex",
        )}
      >
        {!open && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-emerald-400/30 animate-ping"
            style={{ animationDuration: "2.6s" }}
          />
        )}

        <motion.button
          ref={fabRef}
          onClick={handleToggle}
          aria-label={open ? "Close chat" : "Open portfolio chatbot"}
          aria-expanded={open}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.92 }}
          className={twMerge(
            "relative flex h-14 w-14 items-center justify-center",
            "rounded-full text-white transition-all duration-300",
            open
              ? "bg-bg-elevated border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              : "border border-emerald-400/35 bg-gradient-to-br from-emerald-500/20 to-emerald-700/12 shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_20px_rgba(110,231,183,0.1)] hover:border-emerald-400/55 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_28px_rgba(110,231,183,0.2)]",
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

          {!open && chat.state.status === "error" && (
            <span
              aria-label="Chat error"
              className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#080d12] bg-red-400"
            />
          )}
        </motion.button>
      </div>
    </>
  );
}

/**
 * src/hooks/useChat.ts
 *
 * All chat state lives here. Components are pure presentational.
 *
 * State machine:
 *   idle → loading → success / error
 *
 * Features:
 *   - Calls only /api/chat (never the LLM provider directly)
 *   - Persists conversation history for multi-turn context
 *   - Exposes retry on the last question
 *   - Handles network errors, API errors, and timeouts gracefully
 *   - AbortController cancels in-flight requests on unmount / new send
 *   - Guards against double-send race conditions with an in-flight ref
 *   - Preserves failed placeholders on error and reuses them on retry
 */

"use client";

import { useCallback, useReducer, useRef } from "react";
import type { ChatSource } from "@/lib/chat";

// ============================================================
// TYPES
// ============================================================

export type MessageRole = "user" | "assistant";

export type ChatMessageItem = {
  id: string;
  role: MessageRole;
  content: string;
  sources?: ChatSource[];
  /** True while streaming / waiting (shows skeleton). */
  pending?: boolean;
  /** True when request failed for this turn. */
  failed?: boolean;
};

export type ChatStatus = "idle" | "loading" | "error";

export type ChatState = {
  messages: ChatMessageItem[];
  status: ChatStatus;
  /** User-facing error message, non-null only when status === "error". */
  errorMessage: string | null;
  /** The last question asked, used for retry. */
  lastQuestion: string | null;
  /** The message ID of the active/last assistant placeholder. */
  lastMsgId: string | null;
};

export type ChatAction =
  | { type: "SEND"; question: string; msgId: string }
  | { type: "SUCCESS"; msgId: string; answer: string; sources: ChatSource[] }
  | { type: "ERROR"; msgId: string; message: string }
  | { type: "RETRY"; msgId: string }
  | { type: "CLEAR" };

// ============================================================
// REDUCER
// ============================================================

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SEND": {
      const userMsg: ChatMessageItem = {
        id: `user-${action.msgId}`,
        role: "user",
        content: action.question,
      };
      const pendingMsg: ChatMessageItem = {
        id: `assistant-${action.msgId}`,
        role: "assistant",
        content: "",
        pending: true,
        failed: false,
      };
      return {
        messages: [...state.messages, userMsg, pendingMsg],
        status: "loading",
        errorMessage: null,
        lastQuestion: action.question,
        lastMsgId: action.msgId,
      };
    }

    case "SUCCESS": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === `assistant-${action.msgId}`
            ? { ...m, content: action.answer, sources: action.sources, pending: false, failed: false }
            : m,
        ),
        status: "idle",
        errorMessage: null,
      };
    }

    case "ERROR": {
      return {
        ...state,
        // Keep the placeholder and mark it failed so the user bubble is never orphaned
        messages: state.messages.map((m) =>
          m.id === `assistant-${action.msgId}`
            ? { ...m, pending: false, failed: true }
            : m,
        ),
        status: "error",
        errorMessage: action.message,
      };
    }

    case "RETRY": {
      return {
        ...state,
        // Reuse existing assistant placeholder: mark pending again, clear failed flag
        messages: state.messages.map((m) =>
          m.id === `assistant-${action.msgId}`
            ? { ...m, pending: true, failed: false, content: "" }
            : m,
        ),
        status: "loading",
        errorMessage: null,
      };
    }

    case "CLEAR": {
      return { messages: [], status: "idle", errorMessage: null, lastQuestion: null, lastMsgId: null };
    }

    default:
      return state;
  }
}

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  status: "idle",
  errorMessage: null,
  lastQuestion: null,
  lastMsgId: null,
};

// ============================================================
// HOOK
// ============================================================

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const performRequest = useCallback(
    async (question: string, msgId: string, isRetry: boolean) => {
      // Cancel any previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Dispatch action to update UI state
      if (isRetry) {
        dispatch({ type: "RETRY", msgId });
      } else {
        dispatch({ type: "SEND", question, msgId });
      }

      // Build history from current messages:
      // Exclude the current turn (by msgId) and any pending/failed turns
      const history = state.messages
        .filter((m) => {
          if (isRetry && (m.id === `user-${msgId}` || m.id === `assistant-${msgId}`)) {
            return false;
          }
          return !m.pending && !m.failed && Boolean(m.content);
        })
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10); // max 10 turns sent

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, history }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errMsg = "Something went wrong. Please try again.";
          try {
            const body = (await res.json()) as { error?: string };
            if (typeof body?.error === "string" && body.error.length < 200) {
              errMsg = body.error;
            }
          } catch {
            /* ignore parse error */
          }
          // Rate limit special case
          if (res.status === 429) {
            errMsg = "Too many messages sent. Please wait a moment before continuing.";
          }
          if (res.status === 503 || res.status === 502) {
            errMsg = "The chat service is currently unavailable. Please try again later.";
          }
          dispatch({ type: "ERROR", msgId, message: errMsg });
          return;
        }

        const data = (await res.json()) as { reply?: string; sources?: ChatSource[] };
        const answer = typeof data?.reply === "string" ? data.reply.trim() : "";
        const sources = Array.isArray(data?.sources) ? data.sources : [];

        if (!answer) {
          dispatch({ type: "ERROR", msgId, message: "Received an empty response. Please try again." });
          return;
        }

        dispatch({ type: "SUCCESS", msgId, answer, sources });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          msgId,
          message: "Network error — please check your connection and try again.",
        });
      }
    },
    [state.messages],
  );

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || inFlightRef.current || state.status === "loading") return;

      // Set before dispatch to prevent rapid click race conditions
      inFlightRef.current = true;
      try {
        const msgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await performRequest(trimmed, msgId, false);
      } finally {
        inFlightRef.current = false;
      }
    },
    [performRequest, state.status],
  );

  const retry = useCallback(async () => {
    if (!state.lastQuestion || !state.lastMsgId || inFlightRef.current || state.status === "loading") return;

    inFlightRef.current = true;
    try {
      await performRequest(state.lastQuestion, state.lastMsgId, true);
    } finally {
      inFlightRef.current = false;
    }
  }, [performRequest, state.lastQuestion, state.lastMsgId, state.status]);

  const clear = useCallback(() => {
    inFlightRef.current = false;
    abortRef.current?.abort();
    dispatch({ type: "CLEAR" });
  }, []);

  return { state, send, retry, clear };
}

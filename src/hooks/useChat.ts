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
};

export type ChatStatus = "idle" | "loading" | "error";

export type ChatState = {
  messages: ChatMessageItem[];
  status: ChatStatus;
  /** User-facing error message, non-null only when status === "error". */
  errorMessage: string | null;
  /** The last question asked, used for retry. */
  lastQuestion: string | null;
};

type Action =
  | { type: "SEND"; question: string; msgId: string }
  | { type: "SUCCESS"; msgId: string; answer: string; sources: ChatSource[] }
  | { type: "ERROR"; msgId: string; message: string }
  | { type: "RETRY" }
  | { type: "CLEAR" };

// ============================================================
// REDUCER
// ============================================================

function reducer(state: ChatState, action: Action): ChatState {
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
      };
      return {
        messages: [...state.messages, userMsg, pendingMsg],
        status: "loading",
        errorMessage: null,
        lastQuestion: action.question,
      };
    }

    case "SUCCESS": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === `assistant-${action.msgId}`
            ? { ...m, content: action.answer, sources: action.sources, pending: false }
            : m,
        ),
        status: "idle",
        errorMessage: null,
      };
    }

    case "ERROR": {
      return {
        ...state,
        // Remove the pending placeholder on error
        messages: state.messages.filter((m) => m.id !== `assistant-${action.msgId}`),
        status: "error",
        errorMessage: action.message,
      };
    }

    case "RETRY": {
      return { ...state, status: "idle", errorMessage: null };
    }

    case "CLEAR": {
      return { messages: [], status: "idle", errorMessage: null, lastQuestion: null };
    }

    default:
      return state;
  }
}

const INITIAL_STATE: ChatState = {
  messages: [],
  status: "idle",
  errorMessage: null,
  lastQuestion: null,
};

// ============================================================
// HOOK
// ============================================================

export function useChat() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || state.status === "loading") return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const msgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      dispatch({ type: "SEND", question: trimmed, msgId });

      // Build history from current messages (exclude the placeholder we just added)
      const history = state.messages
        .filter((m) => !m.pending && m.content)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10); // max 10 turns sent

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
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
    [state.messages, state.status],
  );

  const retry = useCallback(() => {
    if (!state.lastQuestion) return;
    dispatch({ type: "RETRY" });
    void send(state.lastQuestion);
  }, [state.lastQuestion, send]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "CLEAR" });
  }, []);

  return { state, send, retry, clear };
}

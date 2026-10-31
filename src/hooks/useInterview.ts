/**
 * src/hooks/useInterview.ts
 *
 * Mixed-Format Technical Interview Simulator state machine.
 *
 * Tracks:
 *   - 10 questions per session: 5 MCQ + 5 open-ended, progressing from easy to hardest.
 *   - Blind submission: answers are stored without revealing scores or correctness.
 *   - Full evaluation report (score out of 100, MCQ results with explanations,
 *     written rubrics, topic breakdown, verified sources) is revealed upon completion.
 *
 * State transitions:
 *   idle → starting → question_active → submitting → (next question_active | completing → completed)
 *   Any error allows graceful retry or reset.
 */

"use client";

import { useCallback, useReducer, useRef } from "react";
import type {
  InterviewTrack,
  InterviewDifficulty,
  InterviewQuestion,
  MCQResult,
  WrittenResult,
  TopicScore,
  SessionCompletionReport,
  SubmitAnswerAck,
  StartInterviewResponse,
} from "@/lib/ai-service-client";

// ============================================================
// TYPES
// ============================================================

export type {
  InterviewTrack,
  InterviewDifficulty,
  InterviewQuestion,
  MCQResult,
  WrittenResult,
  TopicScore,
  SessionCompletionReport,
};

export type InterviewPhase =
  | "idle"
  | "starting"
  | "question_active"
  | "submitting"
  | "completing"
  | "completed"
  | "error";

export type InterviewConfig = {
  track: InterviewTrack;
  difficulty?: InterviewDifficulty;
  focus_areas?: string[];
};

export type InterviewState = {
  phase: InterviewPhase;
  sessionId: string | null;
  sessionToken: string | null;
  config: InterviewConfig | null;
  currentQuestion: InterviewQuestion | null;
  questionNumber: number;
  totalQuestions: number;
  answeredCount: number;
  completionReport: SessionCompletionReport | null;
  errorMessage: string | null;
};

export type InterviewAction =
  | { type: "START_REQUEST"; config: InterviewConfig }
  | {
      type: "START_SUCCESS";
      sessionId: string;
      sessionToken: string;
      question: InterviewQuestion;
      totalQuestions: number;
      config: InterviewConfig;
    }
  | { type: "START_ERROR"; message: string }
  | { type: "SUBMIT_REQUEST" }
  | {
      type: "SUBMIT_ACK";
      nextQuestion: InterviewQuestion | null;
      answeredCount: number;
      isComplete: boolean;
    }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "COMPLETING_REQUEST" }
  | { type: "COMPLETE_SUCCESS"; report: SessionCompletionReport }
  | { type: "COMPLETE_ERROR"; message: string }
  | { type: "RESET" };

// ============================================================
// REDUCER
// ============================================================

export const INITIAL_INTERVIEW_STATE: InterviewState = {
  phase: "idle",
  sessionId: null,
  sessionToken: null,
  config: null,
  currentQuestion: null,
  questionNumber: 0,
  totalQuestions: 10,
  answeredCount: 0,
  completionReport: null,
  errorMessage: null,
};

export function interviewReducer(
  state: InterviewState,
  action: InterviewAction,
): InterviewState {
  switch (action.type) {
    case "START_REQUEST":
      return {
        ...INITIAL_INTERVIEW_STATE,
        phase: "starting",
        config: action.config,
      };

    case "START_SUCCESS":
      return {
        ...state,
        phase: "question_active",
        sessionId: action.sessionId,
        sessionToken: action.sessionToken,
        config: action.config,
        currentQuestion: action.question,
        questionNumber: action.question.question_number || 1,
        totalQuestions: action.totalQuestions || 10,
        answeredCount: 0,
        completionReport: null,
        errorMessage: null,
      };

    case "START_ERROR":
      return {
        ...state,
        phase: "error",
        errorMessage: action.message,
      };

    case "SUBMIT_REQUEST":
      return {
        ...state,
        phase: "submitting",
        errorMessage: null,
      };

    case "SUBMIT_ACK":
      if (action.isComplete) {
        return {
          ...state,
          phase: "completing",
          answeredCount: action.answeredCount,
          currentQuestion: null,
          errorMessage: null,
        };
      }
      return {
        ...state,
        phase: "question_active",
        currentQuestion: action.nextQuestion,
        questionNumber: action.nextQuestion ? action.nextQuestion.question_number : state.questionNumber + 1,
        answeredCount: action.answeredCount,
        errorMessage: null,
      };

    case "SUBMIT_ERROR":
      return {
        ...state,
        phase: "question_active",
        errorMessage: action.message,
      };

    case "COMPLETING_REQUEST":
      return {
        ...state,
        phase: "completing",
        errorMessage: null,
      };

    case "COMPLETE_SUCCESS":
      return {
        ...state,
        phase: "completed",
        completionReport: action.report,
        errorMessage: null,
      };

    case "COMPLETE_ERROR":
      return {
        ...state,
        phase: "error",
        errorMessage: action.message,
      };

    case "RESET":
      return { ...INITIAL_INTERVIEW_STATE };

    default:
      return state;
  }
}

// ============================================================
// HOOK
// ============================================================

export function useInterview() {
  const [state, dispatch] = useReducer(interviewReducer, INITIAL_INTERVIEW_STATE);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (config: InterviewConfig) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "START_REQUEST", config });

      try {
        const res = await fetch("/api/interview/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track: config.track,
            focus_areas: config.focus_areas?.filter(Boolean) ?? [],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = "Failed to start the interview session. Please try again.";
          try {
            const body = (await res.json()) as { error?: string };
            if (res.status === 503) {
              message =
                "The Interview Simulator is currently unavailable. Please try again later.";
            } else if (res.status === 429) {
              message = "Too many requests. Please wait a moment before starting.";
            } else if (typeof body?.error === "string" && body.error.length < 200) {
              message = body.error;
            }
          } catch {
            /* ignore parse error */
          }
          dispatch({ type: "START_ERROR", message });
          return;
        }

        const data = (await res.json()) as StartInterviewResponse;
        dispatch({
          type: "START_SUCCESS",
          sessionId: data.session_id,
          sessionToken: data.session_token,
          question: data.initial_question,
          totalQuestions: data.total_questions || 10,
          config,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "START_ERROR",
          message: "Network error — please check your connection and try again.",
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const completeSession = useCallback(
    async (sessionId: string, sessionToken: string) => {
      dispatch({ type: "COMPLETING_REQUEST" });

      try {
        const res = await fetch("/api/interview/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            session_token: sessionToken,
          }),
        });

        if (!res.ok) {
          let message = "Failed to generate evaluation report. Please try again.";
          try {
            const body = (await res.json()) as { error?: string };
            if (typeof body?.error === "string" && body.error.length < 200) {
              message = body.error;
            }
          } catch {
            /* ignore */
          }
          dispatch({ type: "COMPLETE_ERROR", message });
          return;
        }

        const report = (await res.json()) as SessionCompletionReport;
        dispatch({ type: "COMPLETE_SUCCESS", report });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "COMPLETE_ERROR",
          message: "Network error while completing session. Please try again.",
        });
      }
    },
    [],
  );

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (inFlightRef.current) return;
      if (!state.sessionId || !state.sessionToken || !state.currentQuestion) return;
      if (answer.trim().length < 1) return;

      inFlightRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "SUBMIT_REQUEST" });

      try {
        const res = await fetch("/api/interview/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: state.sessionId,
            session_token: state.sessionToken,
            question_id: state.currentQuestion.question_id,
            answer: answer.trim(),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = "Failed to record your answer. Please try again.";
          try {
            const body = (await res.json()) as { error?: string };
            if (res.status === 429) {
              message = "Too many requests. Please wait a moment before submitting.";
            } else if (res.status === 503 || res.status === 502) {
              message = "The evaluation service is currently unavailable.";
            } else if (typeof body?.error === "string" && body.error.length < 200) {
              message = body.error;
            }
          } catch {
            /* ignore */
          }
          dispatch({ type: "SUBMIT_ERROR", message });
          return;
        }

        const ack = (await res.json()) as SubmitAnswerAck;
        dispatch({
          type: "SUBMIT_ACK",
          nextQuestion: ack.next_question ?? null,
          answeredCount: ack.answered_count,
          isComplete: ack.is_complete,
        });

        // If this was the 10th and final answer, automatically finalize evaluation
        if (ack.is_complete && state.sessionId && state.sessionToken) {
          await completeSession(state.sessionId, state.sessionToken);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "SUBMIT_ERROR",
          message: "Network error — please check your connection and try again.",
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [state.sessionId, state.sessionToken, state.currentQuestion, completeSession],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    start,
    submitAnswer,
    completeSession: () => {
      if (state.sessionId && state.sessionToken) {
        completeSession(state.sessionId, state.sessionToken);
      }
    },
    reset,
  };
}

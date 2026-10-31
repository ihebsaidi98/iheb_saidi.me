/**
 * src/lib/interview.ts
 *
 * Types, validation, and constants for the Mixed-Format Technical Interview Simulator.
 */

import {
  type InterviewTrack,
  type InterviewDifficulty,
  type StartInterviewOptions,
  type SubmitAnswerOptions,
  type CompleteInterviewOptions,
} from "./ai-service-client";
import { sanitizeText } from "./chat";

export const VALID_TRACKS: readonly InterviewTrack[] = [
  "full_stack",
  "backend",
  "frontend",
  "ai_ml",
] as const;

export const VALID_DIFFICULTIES: readonly InterviewDifficulty[] = [
  "standard",
  "senior",
  "lead",
] as const;

export const TOTAL_QUESTIONS = 10;
export const MAX_START_BODY_SIZE = 16_384; // 16 KB
export const MAX_SUBMIT_BODY_SIZE = 65_536; // 64 KB
export const MAX_COMPLETE_BODY_SIZE = 16_384; // 16 KB

export const MIN_ANSWER_LENGTH = 1;
export const MAX_ANSWER_LENGTH = 3000;
export const MAX_SESSION_ID_LENGTH = 100;
export const MAX_SESSION_TOKEN_LENGTH = 200;
export const MAX_QUESTION_ID_LENGTH = 100;
export const MAX_FOCUS_AREAS_COUNT = 10;
export const MAX_FOCUS_AREA_LENGTH = 50;

export type ValidationSuccess<T> = {
  valid: true;
  data: T;
};

export type ValidationError = {
  valid: false;
  error: string;
  status: 400 | 422;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validate incoming payload for POST /api/interview/start.
 */
export function validateStartInterviewRequest(
  body: unknown,
): ValidationResult<StartInterviewOptions> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Request body must be a JSON object.",
      status: 400,
    };
  }

  const { track, difficulty, focus_areas } = body as Record<string, unknown>;

  const options: StartInterviewOptions = {};

  if (track !== undefined) {
    if (typeof track !== "string" || !VALID_TRACKS.includes(track as InterviewTrack)) {
      return {
        valid: false,
        error: `track must be one of: ${VALID_TRACKS.join(", ")}.`,
        status: 422,
      };
    }
    options.track = track as InterviewTrack;
  }

  if (difficulty !== undefined) {
    if (
      typeof difficulty !== "string" ||
      !VALID_DIFFICULTIES.includes(difficulty as InterviewDifficulty)
    ) {
      return {
        valid: false,
        error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}.`,
        status: 422,
      };
    }
    options.difficulty = difficulty as InterviewDifficulty;
  }

  if (focus_areas !== undefined) {
    if (!Array.isArray(focus_areas)) {
      return {
        valid: false,
        error: "focus_areas must be an array of strings.",
        status: 422,
      };
    }

    if (focus_areas.length > MAX_FOCUS_AREAS_COUNT) {
      return {
        valid: false,
        error: `focus_areas cannot contain more than ${MAX_FOCUS_AREAS_COUNT} items.`,
        status: 422,
      };
    }

    const cleanedAreas: string[] = [];
    for (const item of focus_areas) {
      if (typeof item !== "string") {
        return {
          valid: false,
          error: "All focus_areas items must be strings.",
          status: 422,
        };
      }
      const sanitized = sanitizeText(item);
      if (sanitized.length === 0) continue;
      if (sanitized.length > MAX_FOCUS_AREA_LENGTH) {
        return {
          valid: false,
          error: `Each focus area must be at most ${MAX_FOCUS_AREA_LENGTH} characters.`,
          status: 422,
        };
      }
      cleanedAreas.push(sanitized);
    }
    options.focus_areas = cleanedAreas;
  }

  return {
    valid: true,
    data: options,
  };
}

/**
 * Validate incoming payload for POST /api/interview/submit.
 */
export function validateSubmitAnswerRequest(
  body: unknown,
): ValidationResult<SubmitAnswerOptions> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Request body must be a JSON object.",
      status: 400,
    };
  }

  const { session_id, session_token, question_id, answer } = body as Record<string, unknown>;

  // session_id validation
  if (typeof session_id !== "string" || session_id.trim().length === 0) {
    return {
      valid: false,
      error: "session_id must be a non-empty string.",
      status: 422,
    };
  }

  const trimmedSessionId = session_id.trim();
  if (trimmedSessionId.length > MAX_SESSION_ID_LENGTH) {
    return {
      valid: false,
      error: `session_id must be at most ${MAX_SESSION_ID_LENGTH} characters.`,
      status: 422,
    };
  }

  // session_token validation
  if (typeof session_token !== "string" || session_token.trim().length === 0) {
    return {
      valid: false,
      error: "session_token must be a non-empty string.",
      status: 422,
    };
  }

  const trimmedSessionToken = session_token.trim();
  if (trimmedSessionToken.length > MAX_SESSION_TOKEN_LENGTH) {
    return {
      valid: false,
      error: `session_token must be at most ${MAX_SESSION_TOKEN_LENGTH} characters.`,
      status: 422,
    };
  }

  // question_id validation
  if (typeof question_id !== "string" || question_id.trim().length === 0) {
    return {
      valid: false,
      error: "question_id must be a non-empty string.",
      status: 422,
    };
  }

  const trimmedQuestionId = question_id.trim();
  if (trimmedQuestionId.length > MAX_QUESTION_ID_LENGTH) {
    return {
      valid: false,
      error: `question_id must be at most ${MAX_QUESTION_ID_LENGTH} characters.`,
      status: 422,
    };
  }

  // answer validation
  if (typeof answer !== "string") {
    return {
      valid: false,
      error: "answer must be a string.",
      status: 422,
    };
  }

  const sanitizedAnswer = sanitizeText(answer);
  if (sanitizedAnswer.length < MIN_ANSWER_LENGTH) {
    return {
      valid: false,
      error: `answer must be at least ${MIN_ANSWER_LENGTH} character.`,
      status: 422,
    };
  }

  if (sanitizedAnswer.length > MAX_ANSWER_LENGTH) {
    return {
      valid: false,
      error: `answer must be at most ${MAX_ANSWER_LENGTH} characters.`,
      status: 422,
    };
  }

  return {
    valid: true,
    data: {
      session_id: trimmedSessionId,
      session_token: trimmedSessionToken,
      question_id: trimmedQuestionId,
      answer: sanitizedAnswer,
    },
  };
}

/**
 * Validate incoming payload for POST /api/interview/complete.
 */
export function validateCompleteInterviewRequest(
  body: unknown,
): ValidationResult<CompleteInterviewOptions> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Request body must be a JSON object.",
      status: 400,
    };
  }

  const { session_id, session_token } = body as Record<string, unknown>;

  if (typeof session_id !== "string" || session_id.trim().length === 0) {
    return {
      valid: false,
      error: "session_id must be a non-empty string.",
      status: 422,
    };
  }

  const trimmedSessionId = session_id.trim();
  if (trimmedSessionId.length > MAX_SESSION_ID_LENGTH) {
    return {
      valid: false,
      error: `session_id must be at most ${MAX_SESSION_ID_LENGTH} characters.`,
      status: 422,
    };
  }

  if (typeof session_token !== "string" || session_token.trim().length === 0) {
    return {
      valid: false,
      error: "session_token must be a non-empty string.",
      status: 422,
    };
  }

  const trimmedSessionToken = session_token.trim();
  if (trimmedSessionToken.length > MAX_SESSION_TOKEN_LENGTH) {
    return {
      valid: false,
      error: `session_token must be at most ${MAX_SESSION_TOKEN_LENGTH} characters.`,
      status: 422,
    };
  }

  return {
    valid: true,
    data: {
      session_id: trimmedSessionId,
      session_token: trimmedSessionToken,
    },
  };
}

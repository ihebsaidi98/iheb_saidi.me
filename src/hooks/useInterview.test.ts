/**
 * src/hooks/useInterview.test.ts
 *
 * Unit tests for the mixed-format interviewReducer state machine.
 * Tests phase transitions, blind submission, 10-question flow, and report completion.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interviewReducer,
  INITIAL_INTERVIEW_STATE,
  type InterviewState,
  type InterviewConfig,
  type InterviewQuestion,
  type SessionCompletionReport,
} from "./useInterview";

const MOCK_CONFIG: InterviewConfig = {
  track: "full_stack",
  focus_areas: [],
};

const MOCK_QUESTION_1: InterviewQuestion = {
  question_id: "fs-mcq-01",
  question_number: 1,
  total_questions: 10,
  question_text: "Which HTTP status code indicates resource creation?",
  question_type: "mcq",
  track: "full_stack",
  topic: "HTTP Status Codes",
  options: ["200 OK", "201 Created", "204 No Content", "301 Moved"],
};

const MOCK_QUESTION_2: InterviewQuestion = {
  question_id: "fs-mcq-02",
  question_number: 2,
  total_questions: 10,
  question_text: "When does a component re-render?",
  question_type: "mcq",
  track: "full_stack",
  topic: "React State",
  options: ["Props change", "State/props change", "setState only", "16ms"],
};

const MOCK_REPORT: SessionCompletionReport = {
  session_id: "session-abc",
  track: "full_stack",
  score_out_of_100: 84.0,
  mcq_score: 40.0,
  written_score: 44.0,
  mcq_results: [
    {
      question_id: "fs-mcq-01",
      question_number: 1,
      topic: "HTTP",
      question_text: "Which HTTP status code indicates resource creation?",
      options: ["200 OK", "201 Created", "204 No Content", "301 Moved"],
      submitted_answer: "201 Created",
      correct_answer: "201 Created",
      correct_answer_index: 1,
      is_correct: true,
      source_url: "https://datatracker.ietf.org/doc/html/rfc7231",
      source_title: "RFC 7231",
      explanation: "201 Created is the standard response.",
    },
  ],
  written_results: [],
  topic_breakdown: [{ topic: "HTTP", score: 10.0, max_score: 10.0 }],
  overall_strengths: ["Strong protocol knowledge"],
  overall_improvements: [],
  total_questions: 10,
};

describe("interviewReducer — mixed-format state machine", () => {
  it("initializes to idle phase with no session or question", () => {
    assert.equal(INITIAL_INTERVIEW_STATE.phase, "idle");
    assert.equal(INITIAL_INTERVIEW_STATE.sessionId, null);
    assert.equal(INITIAL_INTERVIEW_STATE.sessionToken, null);
    assert.equal(INITIAL_INTERVIEW_STATE.currentQuestion, null);
    assert.equal(INITIAL_INTERVIEW_STATE.questionNumber, 0);
    assert.equal(INITIAL_INTERVIEW_STATE.answeredCount, 0);
    assert.equal(INITIAL_INTERVIEW_STATE.completionReport, null);
    assert.equal(INITIAL_INTERVIEW_STATE.errorMessage, null);
  });

  describe("START_REQUEST", () => {
    it("transitions from idle to starting and stores config", () => {
      const state = interviewReducer(INITIAL_INTERVIEW_STATE, {
        type: "START_REQUEST",
        config: MOCK_CONFIG,
      });
      assert.equal(state.phase, "starting");
      assert.deepEqual(state.config, MOCK_CONFIG);
      assert.equal(state.sessionId, null);
      assert.equal(state.sessionToken, null);
    });

    it("resets previous session data when starting a new session", () => {
      const prevState: InterviewState = {
        phase: "completed",
        sessionId: "old-session",
        sessionToken: "old-token",
        config: { track: "backend" },
        currentQuestion: null,
        questionNumber: 10,
        totalQuestions: 10,
        answeredCount: 10,
        completionReport: MOCK_REPORT,
        errorMessage: null,
      };

      const state = interviewReducer(prevState, {
        type: "START_REQUEST",
        config: MOCK_CONFIG,
      });

      assert.equal(state.phase, "starting");
      assert.deepEqual(state.config, MOCK_CONFIG);
      assert.equal(state.sessionId, null);
      assert.equal(state.sessionToken, null);
      assert.equal(state.answeredCount, 0);
      assert.equal(state.completionReport, null);
    });
  });

  describe("START_SUCCESS", () => {
    it("transitions to question_active with session ID, token, and question 1", () => {
      const starting: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "starting",
        config: MOCK_CONFIG,
      };

      const state = interviewReducer(starting, {
        type: "START_SUCCESS",
        sessionId: "session-abc",
        sessionToken: "token-xyz-123",
        question: MOCK_QUESTION_1,
        totalQuestions: 10,
        config: MOCK_CONFIG,
      });

      assert.equal(state.phase, "question_active");
      assert.equal(state.sessionId, "session-abc");
      assert.equal(state.sessionToken, "token-xyz-123");
      assert.deepEqual(state.currentQuestion, MOCK_QUESTION_1);
      assert.equal(state.questionNumber, 1);
      assert.equal(state.totalQuestions, 10);
      assert.equal(state.answeredCount, 0);
      assert.equal(state.errorMessage, null);
    });
  });

  describe("START_ERROR", () => {
    it("transitions to error phase with error message", () => {
      const starting: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "starting",
      };

      const state = interviewReducer(starting, {
        type: "START_ERROR",
        message: "Interview Simulator is unavailable.",
      });

      assert.equal(state.phase, "error");
      assert.equal(state.errorMessage, "Interview Simulator is unavailable.");
    });
  });

  describe("SUBMIT_REQUEST", () => {
    it("transitions from question_active to submitting", () => {
      const active: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "question_active",
        sessionId: "s1",
        sessionToken: "t1",
        currentQuestion: MOCK_QUESTION_1,
        questionNumber: 1,
      };

      const state = interviewReducer(active, { type: "SUBMIT_REQUEST" });

      assert.equal(state.phase, "submitting");
      assert.equal(state.sessionId, "s1");
      assert.equal(state.sessionToken, "t1");
      assert.deepEqual(state.currentQuestion, MOCK_QUESTION_1);
    });
  });

  describe("SUBMIT_ACK", () => {
    it("advances to next question blindly without leaking feedback", () => {
      const submitting: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "submitting",
        sessionId: "s1",
        sessionToken: "t1",
        currentQuestion: MOCK_QUESTION_1,
        questionNumber: 1,
        answeredCount: 0,
      };

      const state = interviewReducer(submitting, {
        type: "SUBMIT_ACK",
        nextQuestion: MOCK_QUESTION_2,
        answeredCount: 1,
        isComplete: false,
      });

      assert.equal(state.phase, "question_active");
      assert.deepEqual(state.currentQuestion, MOCK_QUESTION_2);
      assert.equal(state.questionNumber, 2);
      assert.equal(state.answeredCount, 1);
      assert.equal(state.completionReport, null);
    });

    it("transitions to completing phase when final (10th) answer is acknowledged", () => {
      const submitting: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "submitting",
        sessionId: "s1",
        sessionToken: "t1",
        currentQuestion: MOCK_QUESTION_2,
        questionNumber: 10,
        answeredCount: 9,
      };

      const state = interviewReducer(submitting, {
        type: "SUBMIT_ACK",
        nextQuestion: null,
        answeredCount: 10,
        isComplete: true,
      });

      assert.equal(state.phase, "completing");
      assert.equal(state.currentQuestion, null);
      assert.equal(state.answeredCount, 10);
    });
  });

  describe("COMPLETE_SUCCESS", () => {
    it("transitions to completed phase with full report", () => {
      const completing: InterviewState = {
        ...INITIAL_INTERVIEW_STATE,
        phase: "completing",
        sessionId: "s1",
        sessionToken: "t1",
        answeredCount: 10,
      };

      const state = interviewReducer(completing, {
        type: "COMPLETE_SUCCESS",
        report: MOCK_REPORT,
      });

      assert.equal(state.phase, "completed");
      assert.deepEqual(state.completionReport, MOCK_REPORT);
      assert.equal(state.completionReport?.score_out_of_100, 84.0);
    });
  });

  describe("RESET", () => {
    it("returns to initial state from completed phase", () => {
      const completed: InterviewState = {
        phase: "completed",
        sessionId: "old-session",
        sessionToken: "old-token",
        config: MOCK_CONFIG,
        currentQuestion: null,
        questionNumber: 10,
        totalQuestions: 10,
        answeredCount: 10,
        completionReport: MOCK_REPORT,
        errorMessage: null,
      };

      const state = interviewReducer(completed, { type: "RESET" });
      assert.deepEqual(state, INITIAL_INTERVIEW_STATE);
    });
  });
});

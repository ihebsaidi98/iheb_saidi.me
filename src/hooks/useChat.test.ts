import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chatReducer,
  INITIAL_CHAT_STATE,
  type ChatState,
} from "./useChat";

describe("useChat state machine & reducer", () => {
  it("initializes with empty messages and idle status", () => {
    assert.deepEqual(INITIAL_CHAT_STATE.messages, []);
    assert.equal(INITIAL_CHAT_STATE.status, "idle");
    assert.equal(INITIAL_CHAT_STATE.errorMessage, null);
    assert.equal(INITIAL_CHAT_STATE.lastQuestion, null);
    assert.equal(INITIAL_CHAT_STATE.lastMsgId, null);
  });

  it("adds user and pending assistant placeholder on SEND", () => {
    const state1 = chatReducer(INITIAL_CHAT_STATE, {
      type: "SEND",
      question: "What is your stack?",
      msgId: "m1",
    });

    assert.equal(state1.status, "loading");
    assert.equal(state1.lastQuestion, "What is your stack?");
    assert.equal(state1.lastMsgId, "m1");
    assert.equal(state1.messages.length, 2);

    const userMsg = state1.messages[0];
    const assistantMsg = state1.messages[1];

    assert.equal(userMsg.id, "user-m1");
    assert.equal(userMsg.role, "user");
    assert.equal(userMsg.content, "What is your stack?");

    assert.equal(assistantMsg.id, "assistant-m1");
    assert.equal(assistantMsg.role, "assistant");
    assert.equal(assistantMsg.content, "");
    assert.equal(assistantMsg.pending, true);
    assert.equal(assistantMsg.failed, false);
  });

  it("preserves assistant placeholder and marks failed on ERROR (no orphaned user bubble)", () => {
    const loadingState: ChatState = {
      messages: [
        { id: "user-m1", role: "user", content: "Question 1" },
        { id: "assistant-m1", role: "assistant", content: "", pending: true, failed: false },
      ],
      status: "loading",
      errorMessage: null,
      lastQuestion: "Question 1",
      lastMsgId: "m1",
    };

    const errorState = chatReducer(loadingState, {
      type: "ERROR",
      msgId: "m1",
      message: "API error",
    });

    assert.equal(errorState.status, "error");
    assert.equal(errorState.errorMessage, "API error");
    assert.equal(errorState.lastQuestion, "Question 1");
    assert.equal(errorState.lastMsgId, "m1");

    // Must still have 2 messages: user bubble NOT orphaned, assistant bubble kept & marked failed
    assert.equal(errorState.messages.length, 2);
    assert.equal(errorState.messages[0].id, "user-m1");
    assert.equal(errorState.messages[1].id, "assistant-m1");
    assert.equal(errorState.messages[1].pending, false);
    assert.equal(errorState.messages[1].failed, true);
  });

  it("reuses the existing assistant placeholder on RETRY without creating duplicate bubbles", () => {
    const errorState: ChatState = {
      messages: [
        { id: "user-m1", role: "user", content: "Question 1" },
        { id: "assistant-m1", role: "assistant", content: "", pending: false, failed: true },
      ],
      status: "error",
      errorMessage: "Network error",
      lastQuestion: "Question 1",
      lastMsgId: "m1",
    };

    const retriedState = chatReducer(errorState, {
      type: "RETRY",
      msgId: "m1",
    });

    assert.equal(retriedState.status, "loading");
    assert.equal(retriedState.errorMessage, null);
    // Still exactly 2 messages (no duplicates added!)
    assert.equal(retriedState.messages.length, 2);
    assert.equal(retriedState.messages[0].id, "user-m1");
    assert.equal(retriedState.messages[1].id, "assistant-m1");
    // Placeholder reused: pending again, failed cleared
    assert.equal(retriedState.messages[1].pending, true);
    assert.equal(retriedState.messages[1].failed, false);
    assert.equal(retriedState.messages[1].content, "");
  });

  it("updates placeholder with content and sources on SUCCESS", () => {
    const loadingState: ChatState = {
      messages: [
        { id: "user-m1", role: "user", content: "Question 1" },
        { id: "assistant-m1", role: "assistant", content: "", pending: true, failed: false },
      ],
      status: "loading",
      errorMessage: null,
      lastQuestion: "Question 1",
      lastMsgId: "m1",
    };

    const successState = chatReducer(loadingState, {
      type: "SUCCESS",
      msgId: "m1",
      answer: "Iheb specializes in Java, Spring Boot, and TypeScript.",
      sources: [{ id: "doc-skills", title: "Skills", type: "skills" }],
    });

    assert.equal(successState.status, "idle");
    assert.equal(successState.errorMessage, null);
    assert.equal(successState.messages.length, 2);

    const assistantMsg = successState.messages[1];
    assert.equal(assistantMsg.pending, false);
    assert.equal(assistantMsg.failed, false);
    assert.equal(assistantMsg.content, "Iheb specializes in Java, Spring Boot, and TypeScript.");
    assert.equal(assistantMsg.sources?.length, 1);
  });

  it("resets all state on CLEAR", () => {
    const stateWithMessages: ChatState = {
      messages: [
        { id: "user-m1", role: "user", content: "Hello" },
        { id: "assistant-m1", role: "assistant", content: "Hi", pending: false, failed: false },
      ],
      status: "idle",
      errorMessage: null,
      lastQuestion: "Hello",
      lastMsgId: "m1",
    };

    const cleared = chatReducer(stateWithMessages, { type: "CLEAR" });
    assert.deepEqual(cleared, INITIAL_CHAT_STATE);
  });
});

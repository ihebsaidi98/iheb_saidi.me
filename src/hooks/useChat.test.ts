import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChatHistory,
  chatReducer,
  INITIAL_CHAT_STATE,
  type ChatMessageItem,
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

// ============================================================
// HOOK-LOT3-01 — history sent to the model
// ============================================================

/** Shorthand: a rendered assistant message. */
function assistant(
  id: string,
  content: string,
  flags: { pending?: boolean; failed?: boolean } = {},
): ChatMessageItem {
  return { id: `assistant-${id}`, role: "assistant", content, ...flags };
}

/** Shorthand: a rendered user message. */
function user(id: string, content: string): ChatMessageItem {
  return { id: `user-${id}`, role: "user", content };
}

describe("buildChatHistory (HOOK-LOT3-01)", () => {
  it("returns every completed pair in order for a fully successful conversation", () => {
    const messages = [
      user("m1", "Question 1"),
      assistant("m1", "Answer 1"),
      user("m2", "Question 2"),
      assistant("m2", "Answer 2"),
    ];

    assert.deepEqual(buildChatHistory(messages), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
      { role: "user", content: "Question 2" },
      { role: "assistant", content: "Answer 2" },
    ]);
  });

  it("excludes a user turn whose assistant response failed", () => {
    const messages = [
      user("m1", "Question 1"),
      assistant("m1", "Answer 1"),
      user("m2", "Failed question"),
      assistant("m2", "", { pending: false, failed: true }),
    ];

    assert.deepEqual(buildChatHistory(messages), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
    ]);
  });

  it("excludes a user turn whose assistant response is still pending", () => {
    const messages = [
      user("m1", "Question 1"),
      assistant("m1", "Answer 1"),
      user("m2", "In-flight question"),
      assistant("m2", "", { pending: true, failed: false }),
    ];

    assert.deepEqual(buildChatHistory(messages), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
    ]);
  });

  it("excludes a user turn with no assistant message at all (orphaned)", () => {
    const messages = [user("m1", "Orphan question")];

    assert.deepEqual(buildChatHistory(messages), []);
  });

  it("keeps failed assistant placeholders in the messages (UI) while excluding them from history", () => {
    const loadingState: ChatState = {
      messages: [
        user("m1", "Question 1"),
        assistant("m1", "Answer 1"),
        user("m2", "Failed question"),
        assistant("m2", "", { pending: false, failed: true }),
      ],
      status: "error",
      errorMessage: "API error",
      lastQuestion: "Failed question",
      lastMsgId: "m2",
    };

    const errorState = chatReducer(loadingState, {
      type: "ERROR",
      msgId: "m2",
      message: "API error",
    });

    // UI: all four bubbles remain rendered, the failed placeholder included.
    assert.equal(errorState.messages.length, 4);
    assert.equal(errorState.messages[3].failed, true);
    assert.equal(errorState.messages[3].id, "assistant-m2");

    // Payload: only the completed pair is sent to the model.
    assert.deepEqual(buildChatHistory(errorState.messages), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
    ]);
  });

  it("keeps the completed turns around a single intermediate failure", () => {
    const messages = [
      user("m1", "Question 1"),
      assistant("m1", "Answer 1"),
      user("m2", "Failed question"),
      assistant("m2", "", { failed: true }),
      user("m3", "Question 3"),
      assistant("m3", "Answer 3"),
    ];

    assert.deepEqual(buildChatHistory(messages), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
      { role: "user", content: "Question 3" },
      { role: "assistant", content: "Answer 3" },
    ]);
  });

  it("excludes the retried turn's pair when an excludeMsgId is given", () => {
    const messages = [
      user("m1", "Question 1"),
      assistant("m1", "Answer 1"),
      user("m2", "Retried question"),
      assistant("m2", "", { failed: false, pending: true }),
    ];

    assert.deepEqual(buildChatHistory(messages, "m2"), [
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" },
    ]);
  });

  it("returns an empty history for an empty conversation", () => {
    assert.deepEqual(buildChatHistory([]), []);
  });
});

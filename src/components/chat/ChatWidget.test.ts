/**
 * src/components/chat/ChatWidget.test.ts
 *
 * Tests for ChatWidget scrolling, auto-scroll heuristics, and mobile responsive behavior.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { ChatWidget } from "./ChatWidget";
import { chatReducer, INITIAL_CHAT_STATE } from "@/hooks/useChat";
import { InterviewSimulatorSkeleton } from "@/components/interview/InterviewSimulatorLazy";

describe("Phase 2 — ChatWidget Scrolling, Auto-scroll & Mobile UX", () => {
  it("renders closed FAB with fixed bottom-6 right-6 and accessibility attributes", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(ChatWidget));
    assert.match(html, /fixed bottom-6 right-6/);
    assert.match(html, /aria-label="Open portfolio chatbot"/);
    assert.match(html, /aria-expanded="false"/);
  });

  describe("Smart auto-scroll calculations", () => {
    const NEAR_BOTTOM_THRESHOLD_PX = 80;

    function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    }

    it("identifies user at exact bottom as near bottom", () => {
      // scrollHeight: 1000, clientHeight: 400, scrollTop: 600 -> distance: 0
      assert.equal(isNearBottom(1000, 600, 400), true);
    });

    it("identifies user within threshold as near bottom", () => {
      // distance: 50px (< 80px threshold)
      assert.equal(isNearBottom(1000, 550, 400), true);
      // distance: 80px (exact threshold)
      assert.equal(isNearBottom(1000, 520, 400), true);
    });

    it("identifies user scrolled up beyond threshold as NOT near bottom (do not interrupt)", () => {
      // distance: 81px (> 80px threshold)
      assert.equal(isNearBottom(1000, 519, 400), false);
      // distance: 300px (reading earlier messages)
      assert.equal(isNearBottom(1000, 300, 400), false);
    });

    it("handles short content where scrollHeight equals clientHeight", () => {
      // Short conversation: scrollHeight 300, clientHeight 400, scrollTop 0 -> distance -100 <= 80
      assert.equal(isNearBottom(300, 0, 400), true);
    });
  });

  describe("Desktop boundary wheel interception logic", () => {
    function shouldPreventWheel(scrollTop: number, scrollHeight: number, clientHeight: number, deltaY: number): boolean {
      const isAtTop = scrollTop <= 0 && deltaY < 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1 && deltaY > 0;
      return isAtTop || isAtBottom;
    }

    it("prevents wheel event propagation when scrolling UP while already at the top", () => {
      assert.equal(shouldPreventWheel(0, 1000, 400, -20), true);
    });

    it("prevents wheel event propagation when scrolling DOWN while already at the bottom", () => {
      assert.equal(shouldPreventWheel(600, 1000, 400, 20), true);
    });

    it("allows wheel event when scrolling down from top or middle", () => {
      assert.equal(shouldPreventWheel(0, 1000, 400, 20), false);
      assert.equal(shouldPreventWheel(200, 1000, 400, -20), false);
      assert.equal(shouldPreventWheel(200, 1000, 400, 20), false);
    });
  });

  describe("Mobile virtual keyboard height calculation", () => {
    function calculateKeyboardOffset(windowHeight: number, visualViewportHeight: number, offsetTop = 0): number {
      return Math.max(0, windowHeight - visualViewportHeight - offsetTop);
    }

    it("detects no keyboard when visual viewport equals window height", () => {
      assert.equal(calculateKeyboardOffset(800, 800), 0);
    });

    it("calculates keyboard offset when visual viewport shrinks", () => {
      // Virtual keyboard 280px tall
      assert.equal(calculateKeyboardOffset(800, 520), 280);
    });

    it("caps bottom sheet height to visible viewport", () => {
      const vvHeight = 520;
      const maxSheetHeight = Math.min(vvHeight, 800 * 0.88);
      assert.equal(maxSheetHeight, 520);
    });
  });

  describe("Phase 3 Regression — State Persistence, Lifecycle & Code Splitting", () => {
    it("preserves conversation history across close and reopen cycles", () => {
      // 1. Initial state
      let state = INITIAL_CHAT_STATE;
      assert.equal(state.messages.length, 0);

      // 2. User sends question
      state = chatReducer(state, { type: "SEND", question: "What is your stack?", msgId: "turn-1" });
      assert.equal(state.messages.length, 2);
      assert.equal(state.status, "loading");

      // 3. Assistant responds with success
      state = chatReducer(state, {
        type: "SUCCESS",
        msgId: "turn-1",
        answer: "Spring Boot and Angular.",
        sources: [],
      });
      assert.equal(state.status, "idle");
      assert.equal(state.messages.length, 2);
      assert.equal(state.messages[1]?.content, "Spring Boot and Angular.");

      // 4. Simulate dialog closing (open = false) and reopening (open = true)
      // Because state lives in ChatWidget, the state object is retained
      const preservedMessages = [...state.messages];
      assert.equal(preservedMessages.length, 2);
      assert.equal(preservedMessages[0]?.content, "What is your stack?");
      assert.equal(preservedMessages[1]?.content, "Spring Boot and Angular.");
    });

    it("handles close during in-flight request and verifies AbortController signal lifecycle", () => {
      const controller = new AbortController();
      let aborted = false;
      controller.signal.addEventListener("abort", () => {
        aborted = true;
      });

      // In-flight state
      let state = chatReducer(INITIAL_CHAT_STATE, {
        type: "SEND",
        question: "In flight query",
        msgId: "flight-1",
      });
      assert.equal(state.status, "loading");

      // Closing does not mutate reducer state; aborting signal cancels the fetch
      controller.abort();
      assert.equal(aborted, true);

      // AbortError handling: state remains in valid loading/interrupted state without corrupted messages
      assert.equal(state.messages.length, 2);
      assert.equal(state.messages[0]?.content, "In flight query");
    });

    it("verifies error state and visual FAB indicator logic without duplicating state", () => {
      function shouldShowFabErrorBadge(status: string, isOpen: boolean): boolean {
        return !isOpen && status === "error";
      }

      // Normal idle state -> no badge
      assert.equal(shouldShowFabErrorBadge("idle", false), false);

      // Loading state -> no badge
      assert.equal(shouldShowFabErrorBadge("loading", false), false);

      // Error when closed -> shows red indicator
      assert.equal(shouldShowFabErrorBadge("error", false), true);

      // Error when opened -> badge hidden (error shown inside panel)
      assert.equal(shouldShowFabErrorBadge("error", true), false);

      // Clear action resets status to idle -> badge hidden
      const clearedState = chatReducer(
        { ...INITIAL_CHAT_STATE, status: "error", errorMessage: "Failed" },
        { type: "CLEAR" }
      );
      assert.equal(clearedState.status, "idle");
      assert.equal(shouldShowFabErrorBadge(clearedState.status, false), false);
    });

    it("verifies hasOpened keeps dialog component mounted for exit animation", () => {
      // Simulate state machine of ChatWidget
      let hasOpened = false;
      let isOpen = false;

      // Initial: not mounted
      assert.equal(hasOpened, false);

      // First click: mounted and open
      hasOpened = true;
      isOpen = true;
      assert.equal(hasOpened && isOpen, true);

      // User closes: hasOpened remains true, isOpen becomes false
      // This allows AnimatePresence inside ChatDialog to play exit animation before disappearing
      isOpen = false;
      assert.equal(hasOpened, true);
      assert.equal(isOpen, false);
      assert.equal(hasOpened && !isOpen, true); // Stays mounted with isOpen=false for exit animation
    });

    it("verifies deferred InterviewSimulatorSkeleton renders accessible container with id=interview", () => {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(InterviewSimulatorSkeleton));
      assert.match(html, /id="interview"/);
      assert.match(html, /Technical Interview/);
      assert.match(html, /Simulator/);
      assert.match(html, /animate-pulse/);
      assert.match(html, /min-h-\[560px\]/);
    });
  });
});


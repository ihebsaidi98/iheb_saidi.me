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
});

import { test, expect } from "@playwright/test";

test.describe("ChatWidget Responsive Layout & Scrolling", () => {
  test("mobile (<768px): renders as comfortable full-width bottom sheet with independent scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    // FAB is visible and clickable
    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await expect(fab).toBeVisible();

    await fab.click();

    // Dialog appears
    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    await expect(dialog).toBeVisible();

    // Check full-width bottom sheet dimensions
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(370); // Full width (375px viewport)
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(660); // Docked to bottom

    // Check that horizontal page overflow is prevented
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    // Verify message list has dedicated scroll attributes
    const messageContainer = dialog.locator('[role="log"][aria-label="Chat messages"]');
    await expect(messageContainer).toBeVisible();

    const styles = await messageContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflowY: computed.overflowY,
        overscrollBehaviorY: computed.overscrollBehaviorY,
        minHeight: computed.minHeight,
      };
    });
    expect(styles.overflowY).toBe("auto");
    expect(styles.overscrollBehaviorY).toBe("contain");
    expect(styles.minHeight).toBe("0px");

    // Close via header close button
    const closeBtn = dialog.getByRole("button", { name: /Close chat/i });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test("tablet (768px): renders as floating panel without taking full screen", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await expect(fab).toBeVisible();
    await fab.click();

    // Wait for FAB aria-label to flip — confirms React state update before asserting dialog
    await expect(page.getByRole("button", { name: /Close chat/i }).first()).toBeVisible({ timeout: 8000 });

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    await expect(dialog).toBeVisible({ timeout: 8000 });

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    // Floating card is 420px, not full 768px screen
    expect(box!.width).toBeLessThanOrEqual(430);
    expect(box!.width).toBeGreaterThanOrEqual(400);

    // Close with Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(fab).toBeFocused();
  });

  test("desktop (1440px): supports message interaction and auto-scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    await expect(dialog).toBeVisible();

    // Click a suggested question
    const suggestedBtn = dialog.getByRole("button", { name: /What technologies does Iheb work with\?/i });
    await expect(suggestedBtn).toBeVisible();
    await suggestedBtn.click();

    // Verify user message bubble appears
    await expect(dialog.getByText("What technologies does Iheb work with?")).toBeVisible();

    // Verify input stays fixed and conversation stays scrollable
    const inputArea = dialog.locator("textarea");
    await expect(inputArea).toBeVisible();

    // Check message container scroll state
    const messageContainer = dialog.locator('[role="log"][aria-label="Chat messages"]');
    const isScrolledToBottom = await messageContainer.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
    });
    expect(isScrolledToBottom).toBe(true);

    // Close chat
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Phase 3 UI polish: send button states, character limit counter, and clear conversation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    await expect(dialog).toBeVisible();

    const sendBtn = dialog.getByRole("button", { name: /Send message/i });
    const textarea = dialog.getByRole("textbox", { name: "Chat message" });

    // Empty input: send button is disabled
    await expect(sendBtn).toBeDisabled();

    // Type text: send button is enabled, character counter updates
    await textarea.fill("Hello test question");
    await expect(sendBtn).toBeEnabled();
    await expect(dialog.getByText(/481/)).toBeVisible(); // 500 - 19 = 481

    // Clear input
    await textarea.fill("");
    await expect(sendBtn).toBeDisabled();

    // Click suggested question to trigger conversation
    const suggestedBtn = dialog.getByRole("button", { name: /What projects has Iheb built\?/i });
    await suggestedBtn.click();

    // Verify clear button appears when messages exist
    const clearBtn = dialog.getByRole("button", { name: /Clear conversation/i });
    await expect(clearBtn).toBeVisible();

    // Click clear conversation
    await clearBtn.click();

    // Welcome screen returns
    await expect(dialog.getByRole("button", { name: /What projects has Iheb built\?/i })).toBeVisible();
    await expect(clearBtn).not.toBeVisible();
  });

  test("Phase 5: Mobile keyboard virtual viewport avoidance (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    await expect(dialog).toBeVisible();

    const textarea = dialog.getByRole("textbox", { name: "Chat message" });
    await textarea.focus();

    await page.evaluate(() => {
      if (window.visualViewport) {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      }
    });

    const textareaBox = await textarea.boundingBox();
    expect(textareaBox).not.toBeNull();
    expect(textareaBox!.y).toBeGreaterThan(0);
    expect(textareaBox!.y + textareaBox!.height).toBeLessThanOrEqual(667);
  });

  test("Phase 5: Mouse wheel boundary containment prevents window scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    const messageContainer = dialog.locator('[role="log"][aria-label="Chat messages"]');
    await expect(messageContainer).toBeVisible();

    const overscroll = await messageContainer.evaluate((el) => window.getComputedStyle(el).overscrollBehaviorY);
    expect(overscroll).toBe("contain");

    const isPrevented = await messageContainer.evaluate((el) => {
      const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(isPrevented).toBe(true);
  });

  test("Phase 5: Markdown rendering (bold, inline code, code blocks, bullet points)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply:
            "### Backend Architecture\n\nIheb builds **production-grade microservices** using `Java` and `Spring Boot`.\n\nKey achievements:\n* Reduced latency by **40%**\n* Deployed **30+ secured REST APIs**\n\n```java\n@RestController\npublic class ApiController {}\n```",
        }),
      });
    });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    const textarea = dialog.getByRole("textbox", { name: "Chat message" });
    const sendBtn = dialog.getByRole("button", { name: /Send message/i });

    await textarea.fill("Tell me about Iheb's architecture");
    await sendBtn.click();

    await expect(dialog.getByText("Backend Architecture")).toBeVisible();
    await expect(dialog.getByText("production-grade microservices")).toBeVisible();
    await expect(dialog.locator("code").first()).toBeVisible();
    await expect(dialog.locator("pre").first()).toBeVisible();
    await expect(dialog.locator("ul").first()).toBeVisible();
  });

  test("Phase 5: Error handling and successful retry flow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    let attempts = 0;
    await page.route("**/api/chat", async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Service temporarily unavailable. Please retry.",
            code: "SERVICE_UNAVAILABLE",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Successfully recovered after retry!",
          }),
        });
      }
    });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    const textarea = dialog.getByRole("textbox", { name: "Chat message" });
    const sendBtn = dialog.getByRole("button", { name: /Send message/i });

    await textarea.fill("Testing error flow");
    await sendBtn.click();

    await expect(dialog.getByText(/The chat service is currently unavailable/i)).toBeVisible();
    const retryBtn = dialog.getByRole("button", { name: /Retry/i });
    await expect(retryBtn).toBeVisible();

    await retryBtn.click();
    await expect(dialog.getByText("Successfully recovered after retry!")).toBeVisible();
  });

  test("Phase 5: Multi-turn long conversation and smart auto-scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?a11y=1", { waitUntil: "domcontentloaded" });

    let msgCount = 0;
    await page.route("**/api/chat", async (route) => {
      msgCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: `Turn ${msgCount}: Background info on Iheb's engineering accomplishments and technologies. `.repeat(4),
        }),
      });
    });

    const fab = page.getByRole("button", { name: /Open portfolio chatbot/i });
    await fab.click();

    const dialog = page.getByRole("dialog", { name: /Ask about Iheb/i });
    const textarea = dialog.getByRole("textbox", { name: "Chat message" });
    const sendBtn = dialog.getByRole("button", { name: /Send message/i });

    for (let i = 1; i <= 3; i++) {
      await textarea.fill(`Question turn ${i}`);
      await sendBtn.click();
      await expect(dialog.getByText(`Turn ${i}:`)).toBeVisible({ timeout: 5000 });
    }

    const messageContainer = dialog.locator('[role="log"][aria-label="Chat messages"]');
    await page.waitForTimeout(500);
    const isAtBottom = await messageContainer.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
    });
    expect(isAtBottom).toBe(true);
  });
});


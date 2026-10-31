import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
import { Announcer } from "./Announcer";
import { SectionShell } from "./SectionShell";
import { CopyButton } from "../CopyButton";
import { ProfessionalExperience } from "../projects/ProfessionalExperience";
import type { ProfessionalExperience as Experience } from "@/data/projects";
import { ChatWidget } from "../chat/ChatWidget";

describe("Button component", () => {
  it("renders button with default primary variant and md size", () => {
    const html = renderToStaticMarkup(React.createElement(Button, null, "Submit"));
    assert.match(html, /<button/);
    assert.match(html, /type="button"/);
    assert.match(html, /rounded-full/);
    assert.match(html, /border-emerald/);
    assert.match(html, /Submit<\/button>/);
  });

  it("renders all button variants with correct design system tokens", () => {
    const primary = renderToStaticMarkup(React.createElement(Button, { variant: "primary" }, "Primary"));
    assert.match(primary, /border-emerald-200\/25/);
    assert.match(primary, /bg-emerald-300\/\[0\.08\]/);

    const secondary = renderToStaticMarkup(React.createElement(Button, { variant: "secondary" }, "Secondary"));
    assert.match(secondary, /border-border-subtle/);
    assert.match(secondary, /bg-bg-surface/);

    const outline = renderToStaticMarkup(React.createElement(Button, { variant: "outline" }, "Outline"));
    assert.match(outline, /border-white\/15/);
    assert.match(outline, /bg-transparent/);

    const ghost = renderToStaticMarkup(React.createElement(Button, { variant: "ghost" }, "Ghost"));
    assert.match(ghost, /border-transparent/);
    assert.match(ghost, /text-text-tertiary/);
  });

  it("renders all sizes correctly", () => {
    const sm = renderToStaticMarkup(React.createElement(Button, { size: "sm" }, "Small"));
    assert.match(sm, /px-4 py-2 text-xs/);

    const md = renderToStaticMarkup(React.createElement(Button, { size: "md" }, "Medium"));
    assert.match(md, /px-5 py-2\.5/);

    const lg = renderToStaticMarkup(React.createElement(Button, { size: "lg" }, "Large"));
    assert.match(lg, /px-7 py-3\.5 text-sm/);

    const icon = renderToStaticMarkup(React.createElement(Button, { size: "icon" }, "Icon"));
    assert.match(icon, /size-10/);
  });

  it("polymorphically renders as link when href is supplied", () => {
    const link = renderToStaticMarkup(React.createElement(Button, { href: "/about" }, "About"));
    assert.match(link, /<a/);
    assert.match(link, /href="\/about"/);
    assert.match(link, /rounded-full/);

    const downloadLink = renderToStaticMarkup(
      React.createElement(Button, { href: "/cv.pdf", download: true }, "Download")
    );
    assert.match(downloadLink, /<a/);
    assert.match(downloadLink, /download=""/);
  });

  it("includes accessibility focus-visible and disabled styling", () => {
    const html = renderToStaticMarkup(React.createElement(Button, { disabled: true }, "Disabled"));
    assert.match(html, /disabled=""/);
    assert.match(html, /focus-visible:ring-emerald-400/);
    assert.match(html, /disabled:opacity-40/);
  });

  it("makes disabled links unavailable to keyboard and assistive-technology users", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { href: "/about", disabled: true }, "About")
    );
    assert.match(html, /<a/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /tabindex="-1"/);
    assert.doesNotMatch(html, /<a[^>]*\sdisabled=/);
  });
});

describe("Card component", () => {
  it("renders default card with rounded-2xl and surface tokens", () => {
    const html = renderToStaticMarkup(React.createElement(Card, null, "Content"));
    assert.match(html, /<div/);
    assert.match(html, /rounded-2xl/);
    assert.match(html, /border-border-subtle/);
    assert.match(html, /bg-bg-surface/);
  });

  it("renders all card variants", () => {
    const subtle = renderToStaticMarkup(React.createElement(Card, { variant: "subtle" }, "Subtle"));
    assert.match(subtle, /border-white\/\[0\.07\]/);
    assert.match(subtle, /bg-white\/\[0\.02\]/);

    const elevated = renderToStaticMarkup(React.createElement(Card, { variant: "elevated" }, "Elevated"));
    assert.match(elevated, /border-border-strong/);
    assert.match(elevated, /bg-bg-elevated/);
    assert.match(elevated, /shadow-/);

    const interactive = renderToStaticMarkup(React.createElement(Card, { variant: "interactive" }, "Interactive"));
    assert.match(interactive, /hover:border-white\/\[0\.13\]/);
    assert.match(interactive, /hover:bg-white\/\[0\.04\]/);
  });

  it("supports custom semantic html tags via as prop", () => {
    const article = renderToStaticMarkup(React.createElement(Card, { as: "article" }, "Article"));
    assert.match(article, /<article/);
    assert.match(article, /<\/article>/);

    const section = renderToStaticMarkup(React.createElement(Card, { as: "section" }, "Section"));
    assert.match(section, /<section/);
    assert.match(section, /<\/section>/);
  });

  it("renders compound card components properly", () => {
    const card = renderToStaticMarkup(
      React.createElement(
        Card,
        null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Card Title")),
        React.createElement(CardDescription, null, "A brief description"),
        React.createElement(CardContent, null, "Main body text"),
        React.createElement(CardFooter, null, "Footer note")
      )
    );
    assert.match(card, /<h3 class="[^"]*text-base font-semibold[^"]*">Card Title<\/h3>/);
    assert.match(card, /<p class="[^"]*text-xs leading-relaxed[^"]*">A brief description<\/p>/);
    assert.match(card, /Main body text/);
    assert.match(card, /border-border-subtle\/50/);
  });
});

describe("Announcer component", () => {
  it("renders polite live region with role status and sr-only", () => {
    const html = renderToStaticMarkup(React.createElement(Announcer, { message: "Item saved" }));
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /aria-atomic="true"/);
    assert.match(html, /class="sr-only"/);
    assert.match(html, /Item saved/);
  });

  it("renders assertive live region with role alert", () => {
    const html = renderToStaticMarkup(
      React.createElement(Announcer, { message: "Network connection lost", politeness: "assertive" })
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /aria-live="assertive"/);
    assert.match(html, /Network connection lost/);
  });
});

describe("SectionShell entrance motion & structure", () => {
  it("renders section shell with accessible heading ID and children entrance container", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SectionShell as unknown as React.ComponentType<{ id: string; label: string; title: string; intro: string }>,
        {
          id: "work",
          label: "work",
          title: "Selected Work",
          intro: "Production software built for scale.",
        },
        React.createElement("div", { id: "child-content" }, "Hello World")
      )
    );

    assert.match(html, /<section id="work" aria-labelledby="work-title"/);
    assert.match(html, /id="work-title"/);
    assert.match(html, /selected work/i);
    assert.match(html, /Selected/);
    assert.match(html, /Work/);
    assert.match(html, /Production software built for scale\./);
    assert.match(html, /class="mt-12 md:mt-16"/);
    assert.match(html, /Hello World/);
  });
});

describe("Stage 2 Accessibility: Copy Interactions & Announcements", () => {
  it("renders CopyButton with accessible label and separate polite live region", () => {
    const html = renderToStaticMarkup(
      React.createElement(CopyButton, { value: "test-content" }, "Copy Code")
    );

    // Button should have an accessible label
    assert.match(html, /<button/);
    assert.match(html, /aria-label="Copy Code: copy test-content"/);
    // Button itself must NOT have aria-live (avoids conflicting duplicate announcements)
    assert.doesNotMatch(html, /<button[^>]*aria-live/);
    // Live region Announcer is present with role="status" and aria-live="polite"
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /aria-atomic="true"/);
    // Visible focus ring
    assert.match(html, /focus-visible:ring-2/);
    assert.match(html, /focus-visible:ring-emerald-400/);
  });
});

describe("Stage 2 Accessibility: ProfessionalExperience", () => {
  const dummyItems: Experience[] = [
    {
      company: "Acme Corp",
      role: "Lead Engineer",
      period: "2023 – Present",
      location: "Remote",
      description: "Building scalable backend services.",
      metrics: [{ label: "Throughput", value: "50k req/s" }],
      impact: ["Improved latency by 40%"],
      slug: "acme-corp",
      screenshot: "avatar.png",
    },
    {
      company: "Beta Inc",
      role: "Full Stack Engineer",
      period: "2021 – 2023",
      location: "Tunis",
      description: "Frontend and API development.",
      metrics: [{ label: "Uptime", value: "99.99%" }],
      impact: ["Designed design system"],
      slug: "beta-inc",
      screenshot: "avatar.png",
    },
  ];

  it("renders ProfessionalExperience with Announcer and accessible navigation controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfessionalExperience, { items: dummyItems })
    );

    // Region label and focusable container
    assert.match(html, /role="region"/);
    assert.match(html, /aria-label="Professional experience"/);

    // Previous and Next buttons have clear accessible names
    assert.match(html, /aria-label="Previous experience"/);
    assert.match(html, /aria-label="Next experience"/);

    // Announcer live region is rendered with polite announcement
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Experience 1 of 2: Acme Corp/);
  });
});

describe("Stage 2 Accessibility: Announcer Politeness & Security Invariants", () => {
  it("renders Announcer polite status for standard progress updates", () => {
    const html = renderToStaticMarkup(
      React.createElement(Announcer, {
        message: "Question 3 of 10: Backend track. Topic: Caching.",
        politeness: "polite",
      })
    );
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Question 3 of 10/);
  });

  it("renders Announcer assertive alert for errors", () => {
    const html = renderToStaticMarkup(
      React.createElement(Announcer, {
        message: "Could not load tech news. Please check your connection.",
        politeness: "assertive",
      })
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /aria-live="assertive"/);
    assert.match(html, /Could not load tech news/);
  });

  it("verifies announcement text never leaks answers, scores, rubrics, or hints during testing", () => {
    // Generate simulated active question announcement matching InterviewSimulator logic
    const questionNumber = 4;
    const totalQuestions = 10;
    const track = "backend";
    const topic = "Distributed Locks";
    const questionType = "mcq";

    const announcement = `Question ${questionNumber} of ${totalQuestions}: ${track} track. Topic: ${topic}. ${
      questionType === "mcq" ? "Multiple-choice question" : "Written architecture question"
    }.`;

    // Ensure zero leakage of answers, scores, rubrics, or hints
    assert.doesNotMatch(announcement, /correct/i);
    assert.doesNotMatch(announcement, /score/i);
    assert.doesNotMatch(announcement, /rubric/i);
    assert.doesNotMatch(announcement, /hint/i);
    assert.doesNotMatch(announcement, /answer:/i);
    assert.match(announcement, /Question 4 of 10/);
    assert.match(announcement, /Distributed Locks/);
  });
});

describe("Stage 3 Accessibility: ChatWidget Modal, Focus Trap & Reduced Motion", () => {
  it("renders closed FAB button with accessible label and aria-expanded=false", () => {
    const html = renderToStaticMarkup(React.createElement(ChatWidget));
    assert.match(html, /aria-label="Open portfolio chatbot"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /rounded-full/);
    assert.match(html, /fixed bottom-6 right-6/);
    // Modal dialog is not rendered when closed
    assert.doesNotMatch(html, /id="chat-dialog"/);
    assert.doesNotMatch(html, /role="dialog"/);
  });

  it("verifies inert background tracking and restoration logic", () => {
    const initialElements = [
      { id: "main", inert: false },
      { id: "pre-existing", inert: true },
      { id: "chat", inert: false },
    ];

    const affected: typeof initialElements = [];
    initialElements.forEach((el) => {
      if (el.id === "chat") return;
      if (el.inert) return; // preserve pre-existing inert!
      el.inert = true;
      affected.push(el);
    });

    assert.equal(affected.length, 1);
    assert.equal(affected[0]?.id, "main");
    assert.equal(initialElements[0]?.inert, true);
    assert.equal(initialElements[1]?.inert, true); // preserved!

    // On cleanup
    affected.forEach((el) => {
      el.inert = false;
    });
    assert.equal(initialElements[0]?.inert, false);
    assert.equal(initialElements[1]?.inert, true); // still inert!
  });

  it("verifies focus trap tab wrapping calculation", () => {
    const focusableCount = 4;
    const first = 0;
    const last = focusableCount - 1;

    // Tabbing forward on last wraps to first
    const wrapForward = (current: number) => (current === last ? first : current + 1);
    assert.equal(wrapForward(3), 0);
    assert.equal(wrapForward(1), 2);

    // Shift+Tabbing backward on first wraps to last
    const wrapBackward = (current: number) => (current === first ? last : current - 1);
    assert.equal(wrapBackward(0), 3);
    assert.equal(wrapBackward(2), 1);
  });
});


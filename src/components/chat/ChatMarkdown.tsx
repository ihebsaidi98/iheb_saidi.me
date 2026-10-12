/**
 * src/components/chat/ChatMarkdown.tsx
 *
 * Lightweight, XSS-safe Markdown renderer.
 * Supports: bold, italic, inline code, code blocks, unordered + ordered lists,
 * headings (h1-h3 → styled smaller), and plain paragraphs.
 *
 * Implementation: pure React tree — zero dangerouslySetInnerHTML.
 * All text nodes are safe React strings. No external parser needed.
 */

import React from "react";

type Token =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "code_block"; code: string; lang: string }
  | { kind: "ul_item"; text: string }
  | { kind: "ol_item"; text: string; index: number }
  | { kind: "blank" }
  | { kind: "paragraph"; text: string };

/** Split raw Markdown into block-level tokens. */
function tokenize(raw: string): Token[] {
  const lines = raw.split("\n");
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      tokens.push({ kind: "code_block", code: codeLines.join("\n"), lang });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1]!.length, 3) as 1 | 2 | 3;
      tokens.push({ kind: "heading", level, text: headingMatch[2] ?? "" });
      i++;
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      tokens.push({ kind: "ul_item", text: ulMatch[1] ?? "" });
      i++;
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      tokens.push({ kind: "ol_item", text: olMatch[2] ?? "", index: parseInt(olMatch[1] ?? "1", 10) });
      i++;
      continue;
    }

    // Blank
    if (line.trim() === "") {
      tokens.push({ kind: "blank" });
      i++;
      continue;
    }

    // Paragraph (accumulate consecutive non-special lines)
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").startsWith("```") &&
      !(lines[i] ?? "").match(/^#{1,3}\s/) &&
      !(lines[i] ?? "").match(/^[-*+]\s/) &&
      !(lines[i] ?? "").match(/^\d+\.\s/)
    ) {
      paragraphLines.push(lines[i] ?? "");
      i++;
    }
    if (paragraphLines.length > 0) {
      tokens.push({ kind: "paragraph", text: paragraphLines.join(" ") });
    }
  }

  return tokens;
}

/** Inline spans: bold, italic, inline code. Returns React node array. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Pattern: **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith("**")) {
      parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[0].startsWith("*")) {
      parts.push(<em key={match.index} className="italic text-white/80">{match[3]}</em>);
    } else {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.8em] text-emerald-300/90"
        >
          {match[4]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Group consecutive ul_item / ol_item tokens into list blocks. */
function groupTokens(tokens: Token[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i]!;

    if (t.kind === "blank") {
      i++;
      continue;
    }

    if (t.kind === "ul_item") {
      const items: string[] = [];
      while (i < tokens.length && tokens[i]!.kind === "ul_item") {
        items.push((tokens[i] as { kind: "ul_item"; text: string }).text);
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-4" role="list">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 leading-relaxed text-white/75">
              <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (t.kind === "ol_item") {
      const items: string[] = [];
      let counter = (t as { kind: "ol_item"; text: string; index: number }).index;
      while (i < tokens.length && tokens[i]!.kind === "ol_item") {
        items.push((tokens[i] as { kind: "ol_item"; text: string; index: number }).text);
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1.5 space-y-1 pl-4" role="list">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 leading-relaxed text-white/75">
              <span aria-hidden className="shrink-0 font-mono text-[0.75em] text-emerald-400/60">
                {counter + idx}.
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (t.kind === "heading") {
      const cls =
        t.level === 1
          ? "text-sm font-semibold text-white mt-3 mb-1"
          : t.level === 2
            ? "text-xs font-semibold text-white/90 mt-2.5 mb-1"
            : "text-xs font-medium text-white/80 mt-2 mb-0.5";
      nodes.push(
        <p key={`h-${i}`} className={cls}>
          {renderInline(t.text)}
        </p>,
      );
      i++;
      continue;
    }

    if (t.kind === "code_block") {
      nodes.push(
        <pre
          key={`pre-${i}`}
          className="my-2 overflow-x-auto rounded-lg bg-[#0a0f14] p-3 font-mono text-[0.75em] leading-relaxed text-emerald-300/80"
        >
          <code>{t.code}</code>
        </pre>,
      );
      i++;
      continue;
    }

    if (t.kind === "paragraph") {
      nodes.push(
        <p key={`p-${i}`} className="leading-relaxed text-white/75">
          {renderInline(t.text)}
        </p>,
      );
      i++;
      continue;
    }

    i++;
  }

  return nodes;
}

export function ChatMarkdown({ content }: { content: string }) {
  const tokens = tokenize(content);
  const nodes = groupTokens(tokens);
  return <div className="space-y-1.5 text-[0.825rem]">{nodes}</div>;
}

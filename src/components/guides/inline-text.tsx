import Link from "next/link";
import type { ReactNode } from "react";
import "./guides.css";

/**
 * The inline text subset the guide content is written in.
 *
 * Three constructs and nothing else:
 *
 * - `**bold**`
 * - `*italic*`
 * - `[label](href)`, where `href` is an internal path starting with a single `/`
 *   or an absolute `https://` URL
 *
 * Anything else — an unknown scheme, an unbalanced marker, a stray bracket, an
 * HTML tag — is rendered as the literal characters the author typed. Nothing in
 * the content is ever interpreted as HTML, and nothing goes near
 * `dangerouslySetInnerHTML`. The parser is a pure function and the component is a
 * thin wrapper, so the hostile-input tests can assert on the tree rather than on
 * markup strings.
 */

export type InlineNode =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly InlineNode[] }
  | { readonly kind: "em"; readonly children: readonly InlineNode[] }
  | {
      readonly kind: "link";
      readonly href: string;
      readonly external: boolean;
      readonly children: readonly InlineNode[];
    };

/** Deeper nesting than this is a typo rather than emphasis; it renders literally. */
const MAX_DEPTH = 4;

/** A link target longer than this is not a link anyone meant to write. */
const MAX_HREF_LENGTH = 2048;

/** Control characters, whitespace and backslashes never belong in a link target. */
const FORBIDDEN_IN_HREF = /[\u0000-\u0020\u007f-\u009f\\]/;

/**
 * Decides whether a link target is one the content model allows.
 *
 * Internal targets must be a single slash followed by a path: `//host` is a
 * protocol-relative URL and therefore external, and `/\host` is read as `//host`
 * by browsers that normalise backslashes, so neither is accepted. External
 * targets must parse as an `https:` URL with no embedded credentials.
 */
export function classifyHref(href: string): "internal" | "external" | null {
  if (href.length === 0 || href.length > MAX_HREF_LENGTH) return null;
  if (FORBIDDEN_IN_HREF.test(href)) return null;

  if (href.startsWith("/")) {
    if (href.startsWith("//")) return null;
    return "internal";
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username !== "" || parsed.password !== "") return null;
    return "external";
  } catch {
    return null;
  }
}

/**
 * The matching closer of every opening bracket and parenthesis in one pass, so a
 * paragraph of unmatched brackets costs linear time rather than one scan per
 * bracket. A character with no closer is absent from both maps.
 */
interface Brackets {
  readonly square: ReadonlyMap<number, number>;
  readonly round: ReadonlyMap<number, number>;
}

function matchBrackets(text: string): Brackets {
  const square = new Map<number, number>();
  const round = new Map<number, number>();
  const squareStack: number[] = [];
  const roundStack: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "[") {
      squareStack.push(index);
    } else if (char === "]") {
      const open = squareStack.pop();
      if (open !== undefined) square.set(open, index);
    } else if (char === "(") {
      roundStack.push(index);
    } else if (char === ")") {
      const open = roundStack.pop();
      if (open !== undefined) round.set(open, index);
    }
  }

  return { square, round };
}

function pushText(nodes: InlineNode[], value: string): void {
  if (value.length === 0) return;
  const last = nodes[nodes.length - 1];
  if (last !== undefined && last.kind === "text") {
    nodes[nodes.length - 1] = { kind: "text", value: last.value + value };
    return;
  }
  nodes.push({ kind: "text", value });
}

/**
 * Parses the inline subset into a tree.
 *
 * Unmatched markers are kept in the text and never throw: a guide paragraph with a
 * stray asterisk still renders, and the author sees the character rather than a
 * silently half-formatted sentence.
 */
export function parseInline(source: string, depth = 0): readonly InlineNode[] {
  if (typeof source !== "string" || source.length === 0) return [];
  if (depth > MAX_DEPTH) return [{ kind: "text", value: source }];

  const nodes: InlineNode[] = [];
  const brackets = matchBrackets(source);
  /* Once a closer has proved absent, no later marker of that kind is searched for. */
  const missingCloser = new Set<string>();
  let plainStart = 0;
  let index = 0;

  const flushPlain = (upto: number) => {
    if (upto > plainStart) pushText(nodes, source.slice(plainStart, upto));
  };

  while (index < source.length) {
    const char = source[index];

    if (char === "*") {
      const isBold = source[index + 1] === "*";
      const marker = isBold ? "**" : "*";
      const contentStart = index + marker.length;
      const closer = missingCloser.has(marker) ? -1 : source.indexOf(marker, contentStart);

      if (closer === -1) {
        missingCloser.add(marker);
        index += 1;
        continue;
      }
      if (closer === contentStart) {
        // An empty pair: emit one character so the scan moves on.
        index += 1;
        continue;
      }

      flushPlain(index);
      const children = parseInline(source.slice(contentStart, closer), depth + 1);
      nodes.push(isBold ? { kind: "strong", children } : { kind: "em", children });
      index = closer + marker.length;
      plainStart = index;
      continue;
    }

    if (char === "[") {
      const labelEnd = brackets.square.get(index);
      const targetEnd = labelEnd === undefined ? undefined : brackets.round.get(labelEnd + 1);

      if (labelEnd === undefined || targetEnd === undefined || source[labelEnd + 1] !== "(") {
        index += 1;
        continue;
      }

      const label = source.slice(index + 1, labelEnd);
      const href = source.slice(labelEnd + 2, targetEnd).trim();
      const kind = classifyHref(href);

      if (kind === null || label.trim().length === 0) {
        index += 1;
        continue;
      }

      flushPlain(index);
      nodes.push({
        kind: "link",
        href,
        external: kind === "external",
        children: parseInline(label, depth + 1),
      });
      index = targetEnd + 1;
      plainStart = index;
      continue;
    }

    index += 1;
  }

  flushPlain(source.length);
  return nodes;
}

/** The plain text of an inline tree, for accessible names and tests. */
export function inlinePlainText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => (node.kind === "text" ? node.value : inlinePlainText(node.children)))
    .join("");
}

function renderNodes(nodes: readonly InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.kind) {
      case "text":
        return node.value;
      case "strong":
        return <strong key={key}>{renderNodes(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderNodes(node.children, key)}</em>;
      case "link":
        return node.external ? (
          /* No target=_blank: a citation inside a paragraph should not cost the
             reader their place in the chapter. */
          <a key={key} href={node.href} rel="noopener noreferrer" className="tml-guide-link">
            {renderNodes(node.children, key)}
          </a>
        ) : (
          <Link key={key} href={node.href} className="tml-guide-link">
            {renderNodes(node.children, key)}
          </Link>
        );
    }
  });
}

export interface InlineTextProps {
  /** Text in the supported subset. */
  readonly text: string;
  /** Optional class on the wrapper. */
  readonly className?: string;
}

/**
 * Renders inline text. The wrapper is a `<span>` so it can sit inside a paragraph,
 * a list item, a table cell or a heading without changing the document outline.
 */
export function InlineText({ text, className }: InlineTextProps) {
  return <span className={className}>{renderNodes(parseInline(text), "i")}</span>;
}

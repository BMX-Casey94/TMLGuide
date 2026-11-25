/**
 * A deliberately small renderer for news article bodies.
 *
 * `newsItemSchema` stores `body` as Markdown source, and the render layer owns the
 * conversion, so nothing that reaches the page is HTML from the database. This is
 * the whole parser: blank-line-separated paragraphs, `## ` headings, `- ` bullet
 * lists and `**bold**` runs. Anything else is shown as the characters the author
 * typed, which is the safe failure: no tag in the data can become an element, and
 * no link in the data can become an anchor.
 *
 * Markdown links are deliberately not supported. A citation is a structured
 * `source` on the record, which the page renders with its host and check date, so
 * a link written into the body would be an uncited claim dressed as a citation.
 */

/** One block of article content. */
export type NewsBlock =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] };

/**
 * Splits a body into blocks.
 *
 * A heading closes whatever block came before it, so `## ` inside a list ends the
 * list rather than becoming a bullet whose text starts with hashes.
 */
export function parseNewsBody(source: string): readonly NewsBlock[] {
  const blocks: NewsBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ kind: "list", items: list });
    list = [];
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("##")) {
      // A heading is `##` followed by a space, or a bare `##` with nothing after
      // it. The second form is a typo; matching it here means it is dropped
      // rather than becoming a paragraph whose text is two hash characters.
      const remainder = line.slice(2);
      if (remainder === "" || /^\s/.test(remainder)) {
        flushParagraph();
        flushList();
        const text = remainder.trim();
        // An empty heading renders as nothing rather than as a zero-height
        // heading a screen reader would still announce.
        if (text !== "") blocks.push({ kind: "heading", text });
        continue;
      }
    }

    if (line.startsWith("- ") || line === "-") {
      flushParagraph();
      // A bare hyphen is an empty bullet: dropped, so it cannot surface as a
      // paragraph whose text is one dash.
      const item = line === "-" ? "" : line.slice(2).trim();
      if (item !== "") list.push(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** One run of text inside a line: plain, or emphasised. */
export interface NewsRun {
  readonly text: string;
  readonly strong: boolean;
}

/**
 * Splits a line on `**` pairs. An unpaired marker stays in the text, so a stray
 * asterisk is visible to the author rather than silently swallowed.
 */
export function parseNewsInline(text: string): readonly NewsRun[] {
  const runs: NewsRun[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index), strong: false });
    }
    const bold = match[1];
    if (bold !== undefined && bold !== "") runs.push({ text: bold, strong: true });
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor), strong: false });
  return runs;
}

/**
 * A deliberately small renderer for the Markdown subset the FAQ data uses.
 *
 * The FAQ answers are stored as Markdown source, and the brief forbids
 * `dangerouslySetInnerHTML` with data. Rather than pull in a parser, this
 * handles the four things the answers actually contain: paragraph breaks,
 * bullet lists, **bold** runs, and ordinary text. Anything else is rendered as
 * the literal characters the author typed, which is the safe failure: no tag in
 * the data can become an element, and no link in the data can become an anchor.
 */

/** One block of content: a paragraph or a list of bullet items. */
export type RichBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] };

/**
 * Splits Markdown into paragraphs and bullet lists. A line that starts with
 * "- " begins a list item; consecutive such lines form one list. Blank lines
 * end a block.
 */
export function parseRichText(source: string): readonly RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
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
export interface InlineRun {
  readonly text: string;
  readonly strong: boolean;
}

/**
 * Splits a line on `**` pairs. Unpaired markers stay in the text, so a stray
 * asterisk is visible to the author rather than silently swallowed.
 */
export function parseInline(text: string): readonly InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index), strong: false });
    }
    runs.push({ text: match[1], strong: true });
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), strong: false });
  }
  return runs;
}

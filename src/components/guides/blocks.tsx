import type { GuideBlock, GuideChapter, GuideSource } from "@/content/schema";
import { DataBlock } from "./data-block";
import { InlineText } from "./inline-text";
import "./guides.css";

/**
 * The block renderer for a chapter.
 *
 * Every block type in `src/content/schema.ts` has one renderer here, and nothing
 * else reads a block: a new block type in the schema fails the type check in
 * `renderBlock` until it is handled. Text always goes through `InlineText`, which
 * never produces HTML from content, so a `<script>` in a chapter is displayed as
 * the characters the author typed.
 */

/** One entry in the table of contents. */
export interface TocEntry {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

/**
 * Every `h2` and `h3` in a chapter, in document order.
 *
 * The ids come from the chapter itself, not from the heading text, so an anchor
 * survives a retitled heading and matches what the content authors link to.
 */
export function tableOfContents(chapter: Pick<GuideChapter, "blocks">): readonly TocEntry[] {
  const entries: TocEntry[] = [];
  for (const block of chapter.blocks) {
    if (block.type === "h2" || block.type === "h3") {
      entries.push({ id: block.id, text: block.text, level: block.type === "h2" ? 2 : 3 });
    }
  }
  return entries;
}

/**
 * The source markers a block cites, as `[1]`-style superscript links.
 *
 * The numbers are the position of the source in the chapter's own `sources` list,
 * so a marker in the text and the entry in the Sources section always agree.
 */
export function sourceNumbers(
  chapter: Pick<GuideChapter, "sources">,
  refs: readonly string[] | undefined,
): readonly { readonly number: number; readonly source: GuideSource }[] {
  if (refs === undefined || refs.length === 0) return [];
  return refs.flatMap((ref) => {
    const index = chapter.sources.findIndex((source) => source.id === ref);
    if (index === -1) return [];
    const source = chapter.sources[index];
    return source === undefined ? [] : [{ number: index + 1, source }];
  });
}

export interface SourceMarkersProps {
  readonly chapter: Pick<GuideChapter, "sources" | "slug">;
  readonly refs: readonly string[] | undefined;
}

/**
 * The small linked markers beside a paragraph, list or callout.
 *
 * Each marker's accessible name names the source number ("Source 1"), so a screen
 * reader hears a labelled link rather than a bare numeral.
 */
export function SourceMarkers({ chapter, refs }: SourceMarkersProps) {
  const markers = sourceNumbers(chapter, refs);
  if (markers.length === 0) return null;

  return (
    <span className="tml-guide-markers">
      {markers.map(({ number }) => (
        <a
          key={number}
          href={`#source-${chapter.slug}-${number}`}
          className="tml-guide-marker"
          aria-label={`Source ${number}`}
        >
          {/* One string, not three text nodes: otherwise a screen reader may read
              the brackets and the number as separate tokens. */}
          {`[${number}]`}
        </a>
      ))}
    </span>
  );
}

const CALLOUT_ROLES: Readonly<Record<"note" | "warning" | "tip", string>> = {
  note: "Note",
  warning: "Warning",
  tip: "Tip",
};

export interface BlockRendererProps {
  readonly chapter: GuideChapter;
  /** Block index, used only for React keys. */
}

/**
 * Renders one block.
 *
 * The `data` block is the only one that reaches outside the chapter: it reads the
 * verified records by edition and collection, so a price can only change in the
 * data file and can never be retyped into prose.
 */
export function GuideBlockView({ chapter, block, index }: BlockRendererProps & { block: GuideBlock; index: number }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.id} className="tml-guide-h2" tabIndex={-1}>
          {block.text}
        </h2>
      );

    case "h3":
      return (
        <h3 id={block.id} className="tml-guide-h3" tabIndex={-1}>
          {block.text}
        </h3>
      );

    case "p":
      return (
        <p className="tml-guide-p">
          <InlineText text={block.text} />
          <SourceMarkers chapter={chapter} refs={block.sources} />
        </p>
      );

    case "ul":
      return (
        <div className="tml-guide-list-wrap">
          <ul className="tml-guide-list">
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>
                <InlineText text={item} />
              </li>
            ))}
          </ul>
          <SourceMarkers chapter={chapter} refs={block.sources} />
        </div>
      );

    case "ol":
      return (
        <div className="tml-guide-list-wrap">
          <ol className="tml-guide-list">
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>
                <InlineText text={item} />
              </li>
            ))}
          </ol>
          <SourceMarkers chapter={chapter} refs={block.sources} />
        </div>
      );

    case "callout":
      return (
        <aside
          className={`tml-guide-callout tml-guide-callout--${block.tone}`}
          /*
            `role="note"` and not the implicit `complementary`: a chapter carries
            several callouts, and a landmark each would crowd the landmark list a
            screen reader offers. A note is announced with its label while reading
            and stays out of that list.
          */
          role="note"
          aria-label={`${CALLOUT_ROLES[block.tone]}: ${block.title}`}
        >
          <p className="tml-guide-callout__label label">
            {CALLOUT_ROLES[block.tone]}
            <span className="tml-guide-sr">: {block.title}</span>
          </p>
          <p className="tml-guide-callout__title">{block.title}</p>
          <p className="tml-guide-callout__text">
            <InlineText text={block.text} />
            <SourceMarkers chapter={chapter} refs={block.sources} />
          </p>
        </aside>
      );

    case "facts":
      return (
        <div className="tml-guide-data">
          <div className="tml-guide-data__scroll" role="region" aria-label={block.caption} tabIndex={0}>
            <table className="tml-guide-table">
              <caption className="tml-guide-table__caption">{block.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Detail</th>
                  <th scope="col" className="tml-guide-table__source">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${index}-${rowIndex}`}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <InlineText text={row.value} />
                    </td>
                    <td className="tml-guide-table__source">
                      <SourceMarkers chapter={chapter} refs={row.sources} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "data":
      return (
        <DataBlock
          edition={block.edition}
          collection={block.collection}
          caption={block.caption}
          {...(block.idPrefix === undefined ? {} : { idPrefix: block.idPrefix })}
        />
      );
  }
}

export interface ChapterBlocksProps {
  readonly chapter: GuideChapter;
}

/** Every block of a chapter, in order. */
export function ChapterBlocks({ chapter }: ChapterBlocksProps) {
  return (
    <div className="tml-guide-body">
      {chapter.blocks.map((block, index) => (
        <GuideBlockView key={`${block.type}-${index}`} chapter={chapter} block={block} index={index} />
      ))}
    </div>
  );
}

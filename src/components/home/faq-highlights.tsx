import type { Faq } from "@/data/schemas";
import { SectionAction, SectionHeading } from "@/components/ui/section-heading";
import { CheckSeparator } from "@/components/ui/source-check";
import { highlightedFaqs, faqAnchor } from "./faq-selection";
import { formatLongDate } from "./format";
import { parseInline, parseRichText, type InlineRun } from "./rich-text";

export interface FaqHighlightsProps {
  /** Entries to show. Defaults to the four the site highlights. */
  readonly entries?: readonly Faq[];
  /** Prefix for each `<details>` id, so two accordions can share a page. */
  readonly idPrefix?: string;
}

function Inline({ runs }: { runs: readonly InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.strong ? (
          <strong key={index}>{run.text}</strong>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Renders an FAQ answer from its Markdown source. Paragraphs, bullet lists and
 * **bold** runs are supported; everything else stays literal text, which is why
 * no data ever reaches `dangerouslySetInnerHTML`.
 */
function AnswerBody({ answer }: { answer: string }) {
  return (
    <>
      {parseRichText(answer).map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className="home-faq__list">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline runs={parseInline(item)} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Inline runs={parseInline(block.text)} />
          </p>
        ),
      )}
    </>
  );
}

/**
 * The four questions worth answering before anything else, as a native
 * accordion.
 *
 * `<details>` and `<summary>` are used rather than a scripted widget: the
 * disclosure is keyboard operable with no JavaScript, a screen reader announces
 * its expanded state, and the browser's find-in-page can open a collapsed
 * answer. The shared `name` attribute makes the group behave as one accordion,
 * so opening a second answer closes the first.
 *
 * Each answer carries the official page it was checked against and the date,
 * because an answer without a citation is the thing this site exists to replace.
 */
export function FaqHighlights({ entries, idPrefix = "faq" }: FaqHighlightsProps) {
  const faqs = entries ?? highlightedFaqs();

  return (
    <section className="home-section" aria-labelledby="faq-heading">
      <SectionHeading
        id="faq-heading"
        kicker="Answers"
        title="Four rules that change your trip"
        hairline="none"
        lede="Each answer below comes from the official page named underneath it, checked on the date shown."
        action={<SectionAction href="/guides">All guides</SectionAction>}
      />

      <div className="home-faq">
        {faqs.map((faq) => (
          <details
            key={faq.id}
            id={faqAnchor(idPrefix, faq.id)}
            name={faqAnchor(idPrefix, "accordion")}
            className="home-faq__item"
          >
            <summary className="home-faq__summary">
              <h3 className="home-faq__question">{faq.question}</h3>
              <span className="home-faq__marker" aria-hidden="true" />
            </summary>
            <div className="home-faq__answer">
              <AnswerBody answer={faq.answer} />
              <p className="home-faq__source">
                <span>Source</span>
                <a
                  className="home-faq__source-link"
                  href={faq.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {faq.source.title}
                  <span aria-hidden="true"> ↗</span>
                </a>
                <span>
                  <CheckSeparator />
                  Checked {formatLongDate(faq.lastVerified)}
                </span>
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

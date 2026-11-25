import type { Metadata } from "next";
import { PackingList } from "@/components/tools/packing/packing-list";
import {
  guideForEdition,
  packingItems,
  type PackingItem,
} from "@/components/tools/packing/packing-catalogue";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { guideRegistry } from "@/content";
import { socialMetadata } from "@/lib/seo/social";

const TITLE = "Packing list";
const DESCRIPTION =
  "An interactive Tomorrowland packing checklist for Belgium, Winter and Brasil, split by campsite or off-site stay, with every official item traced to the page that states it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/packing" },
  ...socialMetadata({ path: "/tools/packing", title: TITLE, description: DESCRIPTION }),
};


interface CitedPage {
  readonly url: string;
  readonly title: string;
  readonly checkedOn: string;
}

/**
 * Every page the catalogue cites, with the title it already has in this repo.
 *
 * The catalogue stores a URL and a date per official item, not a title: the
 * title is a fact about the source, and the source of truth for it is the data
 * or guide file that cites the same page. Resolving it here means a renamed
 * page updates the link text everywhere it appears, and a URL that no file in
 * the repo knows is a build failure rather than a bare link.
 */
function guideSources(): readonly CitedPage[] {
  const pages: CitedPage[] = [];
  for (const chapters of Object.values(guideRegistry.byEdition)) {
    for (const chapter of chapters) {
      for (const source of chapter.sources) {
        pages.push({ url: source.url, title: source.title, checkedOn: source.checkedOn });
      }
    }
  }
  return pages;
}

/**
 * Resolves the cited pages for a set of items and notes, and throws if any URL
 * is not already cited elsewhere in the repo.
 *
 * Throwing at build time is deliberate. The alternative is an official item
 * whose link text falls back to a raw URL, which reads as a citation while
 * being unverifiable: exactly the failure the `basis` field exists to prevent.
 */
function resolveCitedPages(entries: readonly { sourceUrl: string; checkedOn: string }[]): Map<string, CitedPage> {
  const known = new Map<string, CitedPage>();
  for (const page of guideSources()) {
    if (!known.has(page.url)) known.set(page.url, page);
  }

  const resolved = new Map<string, CitedPage>();
  const missing: string[] = [];

  for (const entry of entries) {
    const page = known.get(entry.sourceUrl);
    if (page === undefined) {
      missing.push(entry.sourceUrl);
      continue;
    }
    if (page.checkedOn !== entry.checkedOn) {
      missing.push(`${entry.sourceUrl} (catalogue says ${entry.checkedOn}, guide content says ${page.checkedOn})`);
      continue;
    }
    resolved.set(entry.sourceUrl, page);
  }

  if (missing.length > 0) {
    throw new Error(
      `Packing catalogue cites pages the guide content does not: ${[...new Set(missing)].join(", ")}`,
    );
  }

  return resolved;
}

/** The items and notes whose citations have to resolve. */
function citedEntries(items: readonly PackingItem[], editionNotes: readonly { sourceUrl: string; checkedOn: string }[]) {
  const entries: { sourceUrl: string; checkedOn: string }[] = [];
  for (const item of items) {
    if (item.basis === "official") {
      entries.push({ sourceUrl: item.sourceUrl, checkedOn: item.checkedOn });
    }
  }
  entries.push(...editionNotes);
  return entries;
}

/** Every note in every edition's guidance, which the footer also cites. */
function allGuidanceNotes() {
  return (["belgium", "winter", "brasil"] as const).flatMap((edition) => {
    const guide = guideForEdition(edition);
    return [...guide.notAllowed, ...guide.included];
  });
}

/**
 * The page's source list.
 *
 * Built from the catalogue rather than typed here, so the list is exactly the
 * pages the checklist cites, and a withdrawn item removes its source with it.
 */
function packingSources(pages: Map<string, CitedPage>): readonly ToolSource[] {
  return [...pages.values()]
    .map((page) => ({ url: page.url, label: page.title, retrievedOn: page.checkedOn }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
}

/**
 * The packing list page.
 *
 * A Server Component. It resolves every cited page from the repo's own data and
 * guide content, then hands the client checklist a plain URL-to-title map. The
 * catalogue itself is imported by both sides, so the list a reader ticks is the
 * same list the build validated.
 */
export default function PackingToolPage() {
  const pages = resolveCitedPages(citedEntries(packingItems, allGuidanceNotes()));
  const sourceTitles = Object.fromEntries([...pages].map(([url, page]) => [url, page.title]));

  return (
    <ToolShell
      kicker="Preparing"
      title="Packing list"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Packing list" },
      ]}
      intro={
        <>
          <p>
            A checklist per edition and per kind of bed, with your own items added on top. Ticks save
            on this device, and the whole list prints as a clean sheet.
          </p>
          <p>
            Every item marked <strong>Official</strong> comes from a page the rest of this guide
            already cites, and the page is named under the item. Anything without that mark is
            ordinary travel common sense, not a Tomorrowland requirement.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the list cannot be ticked or filtered, but every item is still on the
          page with its source, so it can be read and printed as it stands.
        </p>
      }
      sources={packingSources(pages)}
    >
      <PackingList sourceTitles={sourceTitles} />
    </ToolShell>
  );
}

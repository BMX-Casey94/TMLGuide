import { belgiumChapters } from "./belgium";
import { brasilChapters } from "./brasil";
import { generalChapters } from "./general";
import {
  GUIDE_EDITIONS,
  guideChapterSchema,
  guideEditionMetaSchema,
  type GuideChapter,
  type GuideEdition,
  type GuideEditionMeta,
} from "./schema";
import { winterChapters } from "./winter";

/**
 * The guide registry.
 *
 * Four arrays of chapters, one per edition, are parsed through `guideChapterSchema`
 * at module load. A chapter that does not match the schema, a duplicated
 * `edition/slug` pair or two chapters claiming the same position in one edition
 * throws here, naming the edition and the index, so the failure lands in the build
 * log rather than on a reader's screen.
 *
 * Everything a page needs is derived from this one place: the chapter routes, the
 * prev/next order inside an edition, and the cross-edition `related` links.
 */

export type { GuideChapter, GuideEdition, GuideEditionMeta, GuideSource } from "./schema";
export { GUIDE_EDITIONS } from "./schema";

/** A parsed registry: chapters keyed by edition, plus a lookup by `edition/slug`. */
export interface GuideRegistry {
  readonly byEdition: Readonly<Record<GuideEdition, readonly GuideChapter[]>>;
  readonly byKey: ReadonlyMap<string, GuideChapter>;
}

/** The key a chapter is addressed by everywhere in the registry. */
export function chapterKey(edition: GuideEdition, slug: string): string {
  return `${edition}/${slug}`;
}

/** The public path of a chapter. */
export function chapterPath(chapter: Pick<GuideChapter, "edition" | "slug">): string {
  return `/guides/${chapter.edition}/${chapter.slug}`;
}

/** The public path of an edition hub. */
export function editionPath(edition: GuideEdition): string {
  return `/guides/${edition}`;
}

const EDITION_LABELS: Readonly<Record<GuideEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
  general: "Good to know",
};

/** A short label for an edition, for breadcrumbs and kickers. */
export function editionLabel(edition: GuideEdition): string {
  return EDITION_LABELS[edition];
}

/**
 * Titles and summaries for the four editions.
 *
 * Each summary describes what the edition's chapters cover and nothing more: no
 * date, price or claim that would need its own citation, because this text is not
 * a sourced fact and never carries a check date.
 */
export const EDITION_META: Readonly<Record<GuideEdition, GuideEditionMeta>> = (() => {
  const raw: Record<GuideEdition, GuideEditionMeta> = {
    belgium: {
      edition: "belgium",
      title: "Tomorrowland Belgium",
      summary:
        "The July weekend at De Schorre in Boom: tickets and sale dates, DreamVille, how to get there, add-ons, food and the rules that apply on site.",
    },
    winter: {
      edition: "winter",
      title: "Tomorrowland Winter",
      summary:
        "The March week at Alpe d'Huez: festival tickets and packages, accommodation, transport up the mountain, the stage hours and the gear to bring.",
    },
    brasil: {
      edition: "brasil",
      title: "Tomorrowland Brasil",
      summary:
        "The edition at Parque Maeda in Itu: festival passes and DreamVille packages priced in reais, the sale moments, transport and half-price rules.",
    },
    general: {
      edition: "general",
      title: "Good to know",
      summary:
        "Chapters that apply whatever edition you attend: Pearls and spending on site, One World Radio, recorded sets, the NFT collections and the editions themselves.",
    },
  };

  const parsed = {} as Record<GuideEdition, GuideEditionMeta>;
  for (const edition of GUIDE_EDITIONS) {
    const result = guideEditionMetaSchema.safeParse(raw[edition]);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new Error(`Guide edition metadata for "${edition}" is invalid: ${detail}`);
    }
    parsed[edition] = result.data;
  }
  return parsed;
})();

interface ParseProblem {
  readonly where: string;
  readonly detail: string;
}

function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}

/**
 * Parses one edition's chapter array and checks the invariants a per-chapter
 * schema cannot see: the chapter belongs to the edition whose array holds it, and
 * no two chapters in the edition share a slug or an order.
 *
 * @throws Error naming every problem at once, so one build log line per mistake.
 */
function parseEdition(
  edition: GuideEdition,
  items: readonly unknown[],
  label: string,
): readonly GuideChapter[] {
  const problems: ParseProblem[] = [];
  const parsed: GuideChapter[] = [];

  items.forEach((item, index) => {
    const result = guideChapterSchema.safeParse(item);
    if (!result.success) {
      problems.push({ where: `${label}[${index}]`, detail: describeIssues(result.error.issues) });
      return;
    }
    if (result.data.edition !== edition) {
      problems.push({
        where: `${label}[${index}] (${result.data.slug})`,
        detail: `declares edition "${result.data.edition}" but is listed under "${edition}"`,
      });
      return;
    }
    parsed.push(result.data);
  });

  const slugs = new Map<string, number>();
  const orders = new Map<number, string>();
  for (const chapter of parsed) {
    const slug = slugs.get(chapter.slug);
    if (slug !== undefined) {
      problems.push({
        where: `${edition}/${chapter.slug}`,
        detail: "duplicate slug: two chapters in this edition share it",
      });
    } else {
      slugs.set(chapter.slug, chapter.order);
    }

    const order = orders.get(chapter.order);
    if (order !== undefined) {
      problems.push({
        where: `${edition}/${chapter.slug}`,
        detail: `order ${chapter.order} is also used by "${order}"; orders must be unique within an edition`,
      });
    } else {
      orders.set(chapter.order, chapter.slug);
    }
  }

  if (problems.length > 0) {
    const lines = problems.map((problem) => `  ${problem.where}: ${problem.detail}`);
    throw new Error(`Guide content failed validation:\n${lines.join("\n")}`);
  }

  return [...parsed].sort((a, b) => a.order - b.order);
}

/**
 * Builds a registry from chapter arrays.
 *
 * Exported so a test can run the whole validation and selector set against inline
 * fixtures instead of the real content directories, which content authors are
 * editing in parallel.
 */
export function buildRegistry(input: Readonly<Record<GuideEdition, readonly unknown[]>>): GuideRegistry {
  const byEdition = {} as Record<GuideEdition, readonly GuideChapter[]>;
  const byKey = new Map<string, GuideChapter>();
  const duplicateKeys: string[] = [];

  for (const edition of GUIDE_EDITIONS) {
    const chapters = parseEdition(edition, input[edition], `${edition}Chapters`);
    byEdition[edition] = chapters;
    for (const chapter of chapters) {
      const key = chapterKey(edition, chapter.slug);
      if (byKey.has(key)) duplicateKeys.push(key);
      byKey.set(key, chapter);
    }
  }

  if (duplicateKeys.length > 0) {
    throw new Error(
      `Guide content failed validation:\n  duplicate chapter key: ${duplicateKeys.join(", ")}`,
    );
  }

  return { byEdition, byKey };
}

/**
 * The live registry, parsed once at module load.
 *
 * An edition whose content array is still empty is not an error: the pages show an
 * honest empty state until its chapters land.
 */
export const guideRegistry: GuideRegistry = buildRegistry({
  belgium: belgiumChapters,
  winter: winterChapters,
  brasil: brasilChapters,
  general: generalChapters,
});

/** Every chapter in an edition, sorted by `order`. */
export function editionChapters(
  edition: GuideEdition,
  registry: GuideRegistry = guideRegistry,
): readonly GuideChapter[] {
  return registry.byEdition[edition] ?? [];
}

/** One chapter by edition and slug, or null when it does not exist. */
export function getChapter(
  edition: GuideEdition,
  slug: string,
  registry: GuideRegistry = guideRegistry,
): GuideChapter | null {
  return registry.byKey.get(chapterKey(edition, slug)) ?? null;
}

export interface ChapterNeighbours {
  readonly previous: GuideChapter | null;
  readonly next: GuideChapter | null;
}

/** The chapters either side of this one inside its own edition, by `order`. */
export function neighbours(
  chapter: GuideChapter,
  registry: GuideRegistry = guideRegistry,
): ChapterNeighbours {
  const siblings = editionChapters(chapter.edition, registry);
  const index = siblings.findIndex((candidate) => candidate.slug === chapter.slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: index > 0 ? (siblings[index - 1] ?? null) : null,
    next: index < siblings.length - 1 ? (siblings[index + 1] ?? null) : null,
  };
}

export interface RelatedOptions {
  /**
   * Throw on a `related` pair that does not resolve. Off at runtime, because a
   * stale cross-edition link should cost the reader a missing card rather than the
   * whole page; on in tests, so a typo in `related` fails the suite.
   */
  readonly strict?: boolean;
}

/**
 * Resolves the `related` pairs of a chapter to real chapters, in the order they
 * are listed, dropping duplicates and (outside strict mode) unknown pairs.
 */
export function relatedChapters(
  chapter: GuideChapter,
  options: RelatedOptions = {},
  registry: GuideRegistry = guideRegistry,
): readonly GuideChapter[] {
  const strict = options.strict ?? false;
  const resolved: GuideChapter[] = [];
  const seen = new Set<string>();

  for (const ref of chapter.related) {
    const target = registry.byKey.get(ref);

    if (target === undefined) {
      if (strict) {
        throw new Error(
          `relatedChapters: "${chapterKey(chapter.edition, chapter.slug)}" lists unknown chapter "${ref}"`,
        );
      }
      continue;
    }
    if (seen.has(ref)) continue;
    seen.add(ref);
    resolved.push(target);
  }

  return resolved;
}

/** Every chapter as route params, for `generateStaticParams`. */
export function allChapterParams(
  registry: GuideRegistry = guideRegistry,
): readonly { edition: GuideEdition; chapter: string }[] {
  const params: { edition: GuideEdition; chapter: string }[] = [];
  for (const edition of GUIDE_EDITIONS) {
    for (const chapter of editionChapters(edition, registry)) {
      params.push({ edition, chapter: chapter.slug });
    }
  }
  return params;
}

/**
 * The fallback path `/guides/[edition]/[chapter]` prerenders when no chapter data
 * exists yet.
 *
 * Next 16 with `cacheComponents` rejects an empty `generateStaticParams`, and the
 * chapter directory can be empty while content is being written. This pair matches
 * no chapter, so the route renders its not-found page; it disappears the moment a
 * real chapter exists.
 */
export const PENDING_CHAPTER_PARAM = { edition: "general", chapter: "chapters-pending" } as const;

/**
 * The params the chapter route prerenders: every real chapter, or the single
 * not-found placeholder while there are none.
 */
export function chapterParamsForBuild(
  registry: GuideRegistry = guideRegistry,
): readonly { edition: GuideEdition; chapter: string }[] {
  const params = allChapterParams(registry);
  return params.length > 0 ? params : [PENDING_CHAPTER_PARAM];
}

/** The most recent `lastVerified` date across a set of chapters, or null when empty. */
export function latestCheckedOn(chapters: readonly GuideChapter[]): string | null {
  let latest: string | null = null;
  for (const chapter of chapters) {
    if (latest === null || chapter.lastVerified > latest) latest = chapter.lastVerified;
  }
  return latest;
}

/** Every chapter across every edition, in registry order. */
export function allChapters(registry: GuideRegistry = guideRegistry): readonly GuideChapter[] {
  return GUIDE_EDITIONS.flatMap((edition) => editionChapters(edition, registry));
}

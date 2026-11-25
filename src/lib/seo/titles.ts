import { type GuideChapter, type GuideEdition } from "@/content";

/**
 * Page titles for guide chapters, made unique across the site.
 *
 * A chapter's own `title` is written for the page it sits on ("Accommodation"),
 * which is right in a breadcrumb and wrong in a `<title>`: Belgium and Winter
 * both have an accommodation chapter, so both pages were titled
 * "Accommodation | TMLGuide" and competed with each other in a result list.
 * Appending the edition is what tells the two apart.
 *
 * Three cases need care:
 *
 * 1. Most chapters: `Accommodation — Belgium`.
 * 2. A chapter that already names its edition — the Belgium overview chapter is
 *    titled "Tomorrowland Belgium", the same as its hub — would read
 *    "Tomorrowland Belgium — Belgium". The slug is the honest distinguisher, so
 *    it becomes "Tomorrowland Belgium — Overview".
 * 3. The `general` edition is a section rather than a place ("Good to know"),
 *    so its chapters read `One World Radio — Good to know`, which names the
 *    section the chapter belongs to and separates it from the `/radio` page.
 */

/** The word that names each edition in a title. */
const EDITION_TITLE_SUFFIX: Readonly<Record<GuideEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
  general: "Good to know",
};

/** Turns a kebab-case slug into the words a title shows: `stages-and-hours` → `Stages and hours`. */
export function humaniseSlug(slug: string): string {
  const words = slug.split("-").filter((word) => word.length > 0);
  if (words.length === 0) return slug;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/**
 * The `<title>` of a chapter page, before the site's `| TMLGuide` template is
 * applied. Guaranteed to differ between editions and from the edition hub.
 */
export function chapterPageTitle(
  chapter: Pick<GuideChapter, "edition" | "slug" | "title">,
): string {
  const suffix = EDITION_TITLE_SUFFIX[chapter.edition];
  const title = chapter.title.trim();

  // Case 2: the chapter's own title already carries the edition's name, so the
  // suffix would repeat it. The slug distinguishes the overview from its hub.
  if (title.toLowerCase().includes(suffix.toLowerCase())) {
    return `${title} — ${humaniseSlug(chapter.slug)}`;
  }

  return `${title} — ${suffix}`;
}

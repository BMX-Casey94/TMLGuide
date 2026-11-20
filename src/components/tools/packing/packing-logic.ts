import {
  PACKING_SECTIONS,
  PACKING_STAYS,
  type PackingEdition,
  type PackingItem,
  type PackingSectionId,
  type PackingStay,
  type PackingStayOption,
} from "./packing-catalogue";

/**
 * Pure list logic for the packing tool: which items apply to a reader, how they
 * group into sections, how progress is counted and how an item's text is
 * cleaned before it is stored.
 *
 * Nothing here touches the DOM, storage or React, so every rule can be tested
 * directly. The catalogue is passed in rather than imported, which lets a test
 * run the same functions against a fixture catalogue without touching the real
 * one.
 */

/** The stays that belong to one edition, in catalogue order. */
export function staysForEdition(edition: PackingEdition): readonly PackingStayOption[] {
  return PACKING_STAYS.filter((stay) => stay.edition === edition);
}

/** True when `stay` is one of `edition`'s stays. */
export function isStayForEdition(stay: PackingStay, edition: PackingEdition): boolean {
  return PACKING_STAYS.some((option) => option.id === stay && option.edition === edition);
}

/** The stay an edition opens on, which is the first one listed for it. */
export function defaultStayFor(edition: PackingEdition): PackingStay {
  const first = staysForEdition(edition)[0];
  // The catalogue schema requires every edition to carry items, and every item
  // names an edition that has stays, so this cannot be undefined in practice.
  if (first === undefined) throw new Error(`No stay is defined for "${edition}"`);
  return first.id;
}

/**
 * The catalogue items that apply to one edition and stay.
 *
 * An item with no `stays` applies to every stay of its editions, which is how
 * a shared item such as "phone charger" is written once. An item that names
 * stays applies only to those, so a tent only appears for a campsite reader.
 */
export function itemsFor(
  items: readonly PackingItem[],
  edition: PackingEdition,
  stay: PackingStay,
): readonly PackingItem[] {
  return items.filter((item) => {
    if (!item.editions.includes(edition)) return false;
    // A stay belongs to one edition, so an item scoped to stays is necessarily
    // scoped to that edition too; the catalogue schema checks the pairing.
    if (item.stays === undefined) return true;
    return item.stays.includes(stay);
  });
}

export interface PackingSectionGroup {
  readonly id: PackingSectionId;
  readonly title: string;
  readonly items: readonly PackingItem[];
}

/**
 * Groups items into sections, in the catalogue's own reading order.
 *
 * A section with no items is dropped rather than rendered empty, so a reader
 * never meets "Winter gear" heading with nothing under it. The order and the
 * titles come from `PACKING_SECTIONS`, so there is one place to change either.
 */
export function groupBySection(items: readonly PackingItem[]): readonly PackingSectionGroup[] {
  const groups: PackingSectionGroup[] = [];
  for (const section of PACKING_SECTIONS) {
    const sectionItems = items.filter((item) => item.section === section.id);
    if (sectionItems.length === 0) continue;
    groups.push({ id: section.id, title: section.title, items: sectionItems });
  }
  return groups;
}

/** The ids of every item on the list, for progress and filtering. */
export function itemIds(items: readonly PackingItem[]): readonly string[] {
  return items.map((item) => item.id);
}

/**
 * Drops the items that are already packed.
 *
 * The pack set is treated as untrusted: an id that no longer names an item (a
 * catalogue entry removed between visits, or a hand-edited stored value) simply
 * does not match and therefore does not hide anything.
 */
export function unpackedOnly(
  items: readonly PackingItem[],
  packed: ReadonlySet<string>,
): readonly PackingItem[] {
  return items.filter((item) => !packed.has(item.id));
}

export interface PackingProgress {
  readonly packed: number;
  readonly total: number;
  /** True when there is at least one item and every one of them is packed. */
  readonly complete: boolean;
}

/**
 * Counts how much of the list is packed.
 *
 * Only ids that name a visible entry are counted, so a stale id in storage can
 * never push the figure above the total or report a checklist as complete when
 * entries are still showing. The parameter accepts anything with an id, which
 * lets the caller count the catalogue and the reader's own items in one figure.
 */
export function progressFor(
  entries: readonly { readonly id: string }[],
  packed: ReadonlySet<string>,
): PackingProgress {
  let count = 0;
  for (const entry of entries) {
    if (packed.has(entry.id)) count += 1;
  }
  return { packed: count, total: entries.length, complete: entries.length > 0 && count === entries.length };
}

/** A count of items and how many of them are packed, for the reader's own items. */
export interface CustomProgress {
  readonly packed: number;
  readonly total: number;
}

export function customProgressFor(
  customItems: readonly { readonly id: string }[],
  packed: ReadonlySet<string>,
): CustomProgress {
  let count = 0;
  for (const item of customItems) {
    if (packed.has(item.id)) count += 1;
  }
  return { packed: count, total: customItems.length };
}

/**
 * Cleans a reader's own item before it is stored.
 *
 * Whitespace runs collapse to one space and the ends are trimmed, so "  Sleep
 *   mask " and "Sleep mask" cannot both exist. The result is never rendered as
 * HTML: it travels as a string and reaches the page as a React text child.
 *
 * @returns the cleaned label, or null when nothing is left after trimming.
 */
export function normaliseCustomLabel(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed === "" ? null : collapsed;
}

/** The reader's own items appear under this heading in every edition. */
export const CUSTOM_SECTION_TITLE = "Your own items";

/**
 * Formats the progress line.
 *
 * "0 of 14 packed" rather than a percentage, because the reader wants to know
 * how much is left, and a count is exact where a rounded percentage is not.
 */
export function formatProgress(progress: PackingProgress): string {
  return `${progress.packed} of ${progress.total} packed`;
}

/** The text of the live region, which also reports when the list is finished. */
export function progressAnnouncement(progress: PackingProgress): string {
  if (progress.total === 0) return "No items are listed for this choice.";
  if (progress.complete) return `All ${progress.total} items packed.`;
  return `${formatProgress(progress)}.`;
}

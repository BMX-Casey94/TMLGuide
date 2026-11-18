/**
 * Festival dates for the three editions TMLGuide covers, taken from the shared
 * edition overview and nothing else.
 *
 * Only dates that exist in `src/data/shared/editions.ts` can appear here, so a
 * card cannot show a weekend the data does not record. Belgium's two 2027
 * weekends are separate records; Winter and Brasil are single runs.
 *
 * The overview also keeps the edition immediately behind us (Belgium 2026,
 * Winter 2026) so the record of it is not lost. Those carry `status: "past"`
 * and are dropped here: the home page lists the dates a reader can plan around,
 * and a finished weekend is not one of them.
 */

/** The three editions with a guide on this site. */
export type GuideEditionId = "belgium" | "winter" | "brasil";

export interface EditionDates {
  /** Label taken from the record's own name, for example "Weekend 1". */
  readonly label: string | null;
  readonly startsOn: string;
  readonly endsOn: string;
  /** The record's own location string, for example "Boom, Belgium". */
  readonly location: string;
  readonly venue: string;
}

export interface EditionFestival {
  readonly id: GuideEditionId;
  readonly name: string;
  readonly dates: readonly EditionDates[];
  /** The one location every record for this edition shares, or null. */
  readonly location: string | null;
}

/** Display names, matching the edition switcher in the header. */
export const GUIDE_EDITIONS: readonly { id: GuideEditionId; name: string }[] = [
  { id: "belgium", name: "Belgium" },
  { id: "winter", name: "Winter" },
  { id: "brasil", name: "Brasil" },
];

/** The shape this module needs from one overview record. */
export interface OverviewRecord {
  readonly id: string;
  readonly name: string;
  readonly guideEdition?: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly venue: string;
  readonly location: string;
  readonly status: string;
}

/**
 * Reads the part of a record's name after the em dash, so Belgium's weekends
 * are labelled from the published name ("Tomorrowland Belgium 2027 — Weekend
 * 2") rather than from their position in an array.
 */
export function weekendLabel(name: string): string | null {
  const parts = name.split(" — ");
  const suffix = parts[1]?.trim();
  return suffix === undefined || suffix === "" ? null : suffix;
}

/** True for a record a reader can still plan around. */
function isPlannable(record: OverviewRecord): boolean {
  return record.status !== "past";
}

/**
 * Groups the overview records into one entry per guide edition, preserving the
 * order of {@link GUIDE_EDITIONS}. A record with no `guideEdition` (Thailand)
 * belongs to no card, and a record whose status is "past" is dropped.
 *
 * When an edition's records name more than one location, `location` is null
 * rather than the first one, so the card omits the line instead of picking a
 * venue at random.
 */
export function editionFestivals(records: readonly OverviewRecord[]): readonly EditionFestival[] {
  return GUIDE_EDITIONS.map((edition) => {
    const matching = records.filter(
      (record) => record.guideEdition === edition.id && isPlannable(record),
    );

    const dates = matching.map((record) => ({
      label: weekendLabel(record.name),
      startsOn: record.startsOn,
      endsOn: record.endsOn,
      location: record.location,
      venue: record.venue,
    }));

    const locations = new Set(dates.map((entry) => entry.location));

    return {
      id: edition.id,
      name: edition.name,
      dates,
      location: locations.size === 1 ? dates[0].location : null,
    };
  });
}

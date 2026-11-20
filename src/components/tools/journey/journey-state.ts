import { z } from "zod";
import {
  clearToolState,
  loadToolState,
  saveToolState,
  type StorageLike,
} from "../state";

/**
 * The Journey planner's state.
 *
 * Three choices decide the whole plan: the edition, where the reader sleeps and
 * how they arrive. Nothing travels in the URL, because the plan is not a thing
 * anyone shares: it is the reader's own trip. The only durable store is
 * localStorage under {@link JOURNEY_STORAGE_KEY}, and every read of it goes
 * through {@link journeyStateSchema}.
 */

/** Where the answers are kept between visits. Bumping the version discards old plans. */
export const JOURNEY_STORAGE_KEY = "tml-journey-v1";

export const journeyEditionSchema = z.enum(["belgium", "winter"], {
  error: 'edition must be "belgium" or "winter"',
});
export type JourneyEdition = z.infer<typeof journeyEditionSchema>;

/**
 * Where the reader sleeps.
 *
 * The values are edition-specific in meaning: DreamVille is the Belgium campsite,
 * while `resort`, `oz3300` and `village` are the three Winter arrangements the
 * published data describes. Which values are valid for which edition is decided
 * by {@link SLEEP_OPTIONS}, not by the schema, so a stored plan built on another
 * edition's choice can be repaired rather than thrown away.
 */
export const journeySleepSchema = z.enum(["dreamville", "hotel", "resort", "oz3300", "village"], {
  error: 'sleep must be "dreamville", "hotel", "resort", "oz3300" or "village"',
});
export type JourneySleep = z.infer<typeof journeySleepSchema>;

export const journeyArrivalSchema = z.enum(["flying", "train", "driving", "coach"], {
  error: 'arrival must be "flying", "train", "driving" or "coach"',
});
export type JourneyArrival = z.infer<typeof journeyArrivalSchema>;

export const journeyStateSchema = z.strictObject({
  edition: journeyEditionSchema,
  sleep: journeySleepSchema,
  arrival: journeyArrivalSchema,
});

export type JourneyState = z.infer<typeof journeyStateSchema>;

/** An option a control renders, with the reason it is offered. */
export interface JourneyOption<T extends string> {
  readonly id: T;
  readonly label: string;
  /** One line under the label, saying what the choice means in the data. */
  readonly note: string;
}

function option<T extends string>(id: T, label: string, note: string): JourneyOption<T> {
  return { id, label, note };
}

/** The editions this tool answers for. Brasil is not one of them, and the page says why. */
export const EDITION_OPTIONS: readonly JourneyOption<JourneyEdition>[] = [
  option("belgium", "Belgium", "Two weekends in July at De Schorre, Boom."),
  option("winter", "Winter", "One week in March at Alpe d'Huez."),
];

/**
 * The beds each edition's data actually describes.
 *
 * Belgium publishes DreamVille and nothing else, so the second option is
 * "anywhere off site" rather than an invented hotel list. Winter sells lodging
 * inside a package, in the resort the festival is in, in Oz 3300, or through
 * Sunweb in a surrounding village, which is what the three options name.
 */
export const SLEEP_OPTIONS: Readonly<Record<JourneyEdition, readonly JourneyOption<JourneySleep>[]>> = {
  belgium: [
    option("dreamville", "DreamVille", "The campsite beside the festival site."),
    option("hotel", "Hotel or other", "Any bed off site, booked by you."),
  ],
  winter: [
    option("resort", "Alpe d'Huez package", "Lodging in the resort the festival is in."),
    option("oz3300", "Oz 3300 package", "A separate resort reached by lift."),
    option("village", "Village or own booking", "A surrounding village, or a bed you book yourself."),
  ],
};

export const ARRIVAL_OPTIONS: readonly JourneyOption<JourneyArrival>[] = [
  option("flying", "Plane", "Into an airport the published routes serve."),
  option("train", "Train", "By rail, with the last leg from the station."),
  option("driving", "Car", "Your own vehicle, with parking."),
  option("coach", "Coach", "A shuttle or coach service, or one you organise."),
];

export const JOURNEY_EDITION_LABEL: Readonly<Record<JourneyEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
};

/** Short forms, for the live-region summary rather than for a control label. */
export const SLEEP_SUMMARY_LABEL: Readonly<Record<JourneySleep, string>> = {
  dreamville: "DreamVille",
  hotel: "a hotel off site",
  resort: "an Alpe d'Huez package",
  oz3300: "an Oz 3300 package",
  village: "a village bed",
};

export const ARRIVAL_SUMMARY_LABEL: Readonly<Record<JourneyArrival, string>> = {
  flying: "plane",
  train: "train",
  driving: "car",
  coach: "coach",
};

/** The bed the page opens on for an edition. */
export function defaultSleep(edition: JourneyEdition): JourneySleep {
  const first = SLEEP_OPTIONS[edition][0];
  if (first === undefined) {
    throw new Error(`SLEEP_OPTIONS has no entry for "${edition}"`);
  }
  return first.id;
}

export function defaultJourneyState(edition: JourneyEdition = "belgium"): JourneyState {
  return { edition, sleep: defaultSleep(edition), arrival: "flying" };
}

/** True when the edition's data holds the given bed. */
export function isSupportedSleep(edition: JourneyEdition, sleep: JourneySleep): boolean {
  return SLEEP_OPTIONS[edition].some((entry) => entry.id === sleep);
}

export interface NormalisedJourneyState {
  readonly state: JourneyState;
  /** True when the stored bed belonged to another edition and was moved to this one's default. */
  readonly repaired: boolean;
}

/**
 * Moves a bed that does not exist for the chosen edition onto that edition's
 * default, keeping the edition and the arrival method.
 *
 * This happens legitimately whenever the edition changes, because the two
 * editions do not share a vocabulary: there is no DreamVille at Alpe d'Huez and
 * no Oz 3300 at Boom.
 */
export function normaliseJourneyState(state: JourneyState): NormalisedJourneyState {
  if (isSupportedSleep(state.edition, state.sleep)) return { state, repaired: false };
  return { state: { ...state, sleep: defaultSleep(state.edition) }, repaired: true };
}

export interface LoadedJourneyState {
  readonly state: JourneyState;
  /** True when stored JSON failed the schema, so the page started from the default. */
  readonly discarded: boolean;
  /** True when a validated stored plan named a bed from the other edition. */
  readonly repaired: boolean;
}

/**
 * Reads the stored plan, never throwing.
 *
 * The state helper is given an empty query string on purpose: this tool keeps no
 * state in the URL, so only localStorage can supply a plan. A store that is
 * blocked, over quota or holding tampered JSON answers with the default plan and
 * `discarded: true`, which the page shows as a short note rather than failing.
 */
export function loadJourneyState(storage: StorageLike | null): LoadedJourneyState {
  const loaded = loadToolState({
    schema: journeyStateSchema,
    /* Unused: `search` is empty, so the query-string branch can never match. */
    queryKey: "plan",
    storageKey: JOURNEY_STORAGE_KEY,
    search: "",
    storage,
  });

  const normalised = normaliseJourneyState(loaded.state ?? defaultJourneyState());
  return {
    state: normalised.state,
    discarded: loaded.state === null && loaded.discarded,
    repaired: loaded.state !== null && normalised.repaired,
  };
}

export function saveJourneyState(storage: StorageLike | null, state: JourneyState): void {
  saveToolState(storage, JOURNEY_STORAGE_KEY, state);
}

export function clearJourneyState(storage: StorageLike | null): void {
  clearToolState(storage, JOURNEY_STORAGE_KEY);
}

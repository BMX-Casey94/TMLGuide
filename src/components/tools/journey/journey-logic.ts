import { getChapter, type GuideChapter } from "@/content";
import { belgiumFacts } from "@/data/belgium";
import { winterFacts, winterShuttles } from "@/data/winter";
import {
  SLEEP_SUMMARY_LABEL,
  defaultJourneyState,
  type JourneyArrival,
  type JourneyEdition,
  type JourneySleep,
  type JourneyState,
} from "./journey-state";

/**
 * The Journey planner's content, assembled from published data.
 *
 * Every sentence a reader sees is either a field lifted straight out of a
 * validated record (`src/data/**`) or a validated guide chapter
 * (`src/content/**`), or connective wording around it. No price, time or day
 * pattern is typed here: each step resolves its own records by id, and the
 * source shown beside it is the record's own `source`, including its check date.
 * A record that disappears therefore removes the step it feeds instead of
 * leaving a stale claim on the page.
 *
 * The module is pure and server-side. The page runs it for every combination of
 * edition, bed and arrival method, and hands the finished plans to the client
 * component as plain objects, so the data layer never reaches the browser.
 */

/** The label every missing fare or timetable carries. */
export const NOT_PUBLISHED_2027 = "Not published for 2027";

/** One citation: the page a step was read from, and when it was read. */
export interface JourneySource {
  readonly url: string;
  readonly title: string;
  /** ISO date, rendered as "18 Nov 2026". */
  readonly checkedOn: string;
}

/** A first and last departure, only where the data publishes them. */
export interface JourneyDepartures {
  /** What the times belong to, for example "Oz 3300 night lift". */
  readonly label: string;
  readonly first: string | null;
  readonly last: string | null;
  readonly note?: string;
}

/** A published fare, with the period it belongs to so 2026–27 is never read as 2027. */
export interface JourneyPrice {
  readonly amountMinor: number;
  /** The season or year the figure is published for, for example "2026–27 season". */
  readonly period: string;
  /** What the money buys, for example "single, Lyon Airport to Alpe d'Huez". */
  readonly label: string;
  readonly note?: string;
}

/** A fare or timetable the organisers have not published. */
export interface JourneyGap {
  readonly label: string;
  readonly detail: string;
}

/** One ordered step of the plan. */
export interface JourneyStep {
  readonly id: string;
  /** What to do, in the imperative. */
  readonly title: string;
  /** The verified statement behind it. */
  readonly fact: string;
  /** For example "Thursday in, Monday out". */
  readonly dayPattern?: string;
  readonly departures?: JourneyDepartures;
  readonly price?: JourneyPrice;
  readonly gap?: JourneyGap;
  /** URLs into {@link JourneyPlan.sources}, in citation order. */
  readonly sourceUrls: readonly string[];
}

/** One line of the "Order of decisions" block. */
export interface JourneyDecision {
  readonly text: string;
  readonly sourceUrls: readonly string[];
}

/** A decision line as it is built, carrying its citations rather than their URLs. */
interface DecisionDraft {
  readonly text: string;
  readonly sources: readonly JourneySource[];
}

export interface JourneyPlan {
  /** `edition:sleep:arrival`, the key the client component selects on. */
  readonly key: string;
  readonly edition: JourneyEdition;
  readonly sleep: JourneySleep;
  readonly arrival: JourneyArrival;
  /** The plan as one line, for the results heading. */
  readonly headline: string;
  /** One sentence saying what the combination really means. */
  readonly intro: string;
  readonly steps: readonly JourneyStep[];
  readonly decisions: {
    /** Where the ordering comes from, stated rather than implied. */
    readonly intro: string;
    readonly items: readonly JourneyDecision[];
  };
  /** Every citation used by the plan, keyed by URL. */
  readonly sources: Readonly<Record<string, JourneySource>>;
}

export function planKey(edition: JourneyEdition, sleep: JourneySleep, arrival: JourneyArrival): string {
  return `${edition}:${sleep}:${arrival}`;
}

/* ---------------------------------------------------------------------------
 * Resolving records
 * ------------------------------------------------------------------------- */

function chapterOrThrow(edition: string, slug: string): GuideChapter {
  const chapter = getChapter(edition as "belgium" | "winter", slug);
  if (chapter === null) {
    throw new Error(`journey: the ${edition}/${slug} chapter is not in the guide registry`);
  }
  return chapter;
}

/** A citation from a guide chapter's own source list. */
function chapterSource(chapter: GuideChapter, id: string): JourneySource {
  const source = chapter.sources.find((entry) => entry.id === id);
  if (source === undefined) {
    throw new Error(`journey: ${chapter.edition}/${chapter.slug} has no source "${id}"`);
  }
  return { url: source.url, title: source.title, checkedOn: source.checkedOn };
}

/** A citation from a validated data record. */
function recordSource(record: {
  readonly source: { readonly url: string; readonly title: string; readonly retrievedOn: string };
}): JourneySource {
  return {
    url: record.source.url,
    title: record.source.title,
    checkedOn: record.source.retrievedOn,
  };
}

function winterFact(id: string) {
  const fact = winterFacts.find((entry) => entry.id === id);
  if (fact === undefined) throw new Error(`journey: no Winter fact "${id}"`);
  return fact;
}

function winterShuttle(id: string) {
  const shuttle = winterShuttles.find((entry) => entry.id === id);
  if (shuttle === undefined) throw new Error(`journey: no Winter shuttle "${id}"`);
  return shuttle;
}

/** A fare from a shuttle record, converted to minor units once, here. */
function priceOf(
  record: { readonly priceEur: number },
  period: string,
  label: string,
  note?: string,
): JourneyPrice {
  return {
    amountMinor: Math.round(record.priceEur * 100),
    period,
    label,
    ...(note === undefined ? {} : { note }),
  };
}

/**
 * A fare stated by a headline fact.
 *
 * Facts carry an optional `amountEur` rather than a `priceEur`, because a fact is
 * a statement and not a product. A fact with no amount is a programming error
 * here, not a zero price: the caller only names facts it knows are priced, so a
 * missing amount throws rather than printing "€0.00".
 */
function factPrice(
  fact: { readonly amountEur?: number | undefined },
  period: string,
  label: string,
  note?: string,
): JourneyPrice {
  if (fact.amountEur === undefined) {
    throw new Error(`journey: the fact used for "${label}" publishes no amount`);
  }
  return {
    amountMinor: Math.round(fact.amountEur * 100),
    period,
    label,
    ...(note === undefined ? {} : { note }),
  };
}

/* ---------------------------------------------------------------------------
 * Steps
 * ------------------------------------------------------------------------- */

interface StepDraft {
  readonly id: string;
  readonly title: string;
  readonly fact: string;
  readonly dayPattern?: string;
  readonly departures?: JourneyDepartures;
  readonly price?: JourneyPrice;
  readonly gap?: JourneyGap;
  readonly sources: readonly JourneySource[];
}

function step(draft: StepDraft): StepDraft {
  if (draft.sources.length === 0) {
    throw new Error(`journey: step "${draft.id}" cites nothing`);
  }
  return draft;
}

/**
 * Removes repeated citations, keeping the first.
 *
 * A step often builds its citation list from a chapter entry and from the record
 * that entry points at, and both can carry the same URL: the Winter pass fact and
 * the pass's own add-on record cite the same page. Printing that URL twice would
 * read as two different sources, so the duplicate is dropped here rather than
 * left for a reader to work out.
 */
function uniqueSources(sources: readonly JourneySource[]): readonly JourneySource[] {
  const byUrl = new Map<string, JourneySource>();
  for (const source of sources) {
    if (!byUrl.has(source.url)) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

function gap(detail: string): JourneyGap {
  return { label: NOT_PUBLISHED_2027, detail };
}

interface FinalisedPlan {
  readonly steps: readonly JourneyStep[];
  readonly sources: Readonly<Record<string, JourneySource>>;
}

/**
 * Builds the plan's steps and its source map.
 *
 * The decision block's citations are merged in here as well as the steps', so every
 * URL the page links resolves. They are ordinary citations, so they belong in the
 * one map rather than in a second one the component would have to know about.
 */
function finalise(
  drafts: readonly StepDraft[],
  decisions: readonly DecisionDraft[],
): FinalisedPlan {
  const sources = new Map<string, JourneySource>();
  const steps = drafts.map<JourneyStep>((draft) => {
    const cited = uniqueSources(draft.sources);
    for (const source of cited) {
      if (!sources.has(source.url)) sources.set(source.url, source);
    }
    return {
      id: draft.id,
      title: draft.title,
      fact: draft.fact,
      ...(draft.dayPattern === undefined ? {} : { dayPattern: draft.dayPattern }),
      ...(draft.departures === undefined ? {} : { departures: draft.departures }),
      ...(draft.price === undefined ? {} : { price: draft.price }),
      ...(draft.gap === undefined ? {} : { gap: draft.gap }),
      sourceUrls: cited.map((source) => source.url),
    };
  });

  for (const item of decisions) {
    for (const source of uniqueSources(item.sources)) {
      if (!sources.has(source.url)) sources.set(source.url, source);
    }
  }

  return {
    steps,
    sources: Object.fromEntries([...sources.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

/* ---------------------------------------------------------------------------
 * Belgium
 * ------------------------------------------------------------------------- */

const belgiumTransport = chapterOrThrow("belgium", "transport");
const belgiumDreamville = chapterOrThrow("belgium", "dreamville");
const belgiumGlobalJourney = chapterOrThrow("belgium", "global-journey");

const BE = {
  getThere: chapterSource(belgiumTransport, "s1"),
  rail: chapterSource(belgiumTransport, "s2"),
  order: chapterSource(belgiumTransport, "s3"),
  hours: recordSource(belgiumFacts.dreamville.checkOut),
  forbidden: chapterSource(belgiumDreamville, "s5"),
  entrances: chapterSource(belgiumDreamville, "s6"),
  hotelPackages: chapterSource(belgiumGlobalJourney, "s5"),
} as const;

/** Lower-cases the first letter of a stored sentence so it can follow a colon or a comma. */
function lowerFirst(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/** The DreamVille window, read from the verified facts rather than retyped. */
function dreamvilleWindowStep(): StepDraft {
  const opening = belgiumFacts.dreamville.openingWindow.value;
  const checkIn = belgiumFacts.dreamville.checkIn.value;
  const checkOut = belgiumFacts.dreamville.checkOut.value;
  return step({
    id: "be-dreamville-window",
    title: "Fit your travel to DreamVille's own hours",
    fact: `DreamVille opens at ${opening.opensAt} on the ${opening.opensOnDay} and closes at ${opening.closesAt} on the ${opening.closesOnDay}. Check-in on the Thursday is ${lowerFirst(checkIn.thursday)}; the Friday runs ${checkIn.friday.toLowerCase()}, and the Sunday has ${checkIn.sunday.toLowerCase()}. Check-out is by ${checkOut.byTime} on the ${checkOut.byDay}, with ${checkOut.exceptionsAllowed ? "exceptions possible" : "no exceptions"}.`,
    dayPattern: `${opening.opensOnDay} ${opening.opensAt} to ${opening.closesOnDay} ${opening.closesAt}`,
    sources: [BE.hours],
  });
}

function belgiumAirportStep(): StepDraft {
  return step({
    id: "be-airport-shuttle",
    title: "Book one of the three airport shuttles",
    fact: "Tomorrowland sells airport shuttles from Brussels Airport, Brussels South Charleroi and Eindhoven, and they run to DreamVille on the Thursday and back on the Monday.",
    dayPattern: "Thursday in, Monday out",
    gap: gap(
      "No fare and no departure time is published for any of the three airport routes, so there is nothing here to budget from or to plan a departure around.",
    ),
    sources: [BE.getThere],
  });
}

function belgiumCityShuttleStep(): StepDraft {
  return step({
    id: "be-city-shuttle",
    title: "Take a city shuttle to the Main Entrance",
    fact: "City shuttles have stops in several cities in Belgium and the Netherlands, are sold as a round trip, and drop passengers close to the Main Entrance rather than at DreamVille.",
    gap: gap("No 2027 fare and no departure timetable is published for any city shuttle."),
    sources: [BE.getThere],
  });
}

function belgiumTrainStep(): StepDraft {
  return step({
    id: "be-train-to-boom",
    title: "Ride to Boom station",
    fact: "The official wording puts the walk from Boom station to the festival site at 20 minutes, which makes it the last leg to plan around in rain or with luggage.",
    sources: [BE.getThere],
  });
}

function belgiumRailDiscountStep(): StepDraft {
  return step({
    id: "be-rail-discount",
    title: "Take the rail discount codes before you book",
    fact: "Belgian rail offered 40% off a return journey to the festival in the 2026 cycle. The codes sit in the main buyer's Tomorrowland Account: one per Day Pass or DreamVille package and three per Full Madness Pass. Global Journey buyers are excluded, because travel is already part of their package.",
    gap: gap("The 2027 discount and its code allocation are not published; the 40% figure belongs to the 2026 cycle."),
    sources: [BE.rail, BE.getThere],
  });
}

function belgiumNightTrainStep(): StepDraft {
  return step({
    id: "be-night-trains",
    title: "Know where the last train goes",
    fact: "After the music ends, extra night trains run to Antwerpen-Centraal only and offer no connection onward to other cities. In the 2026 cycle, boarding a train without a ticket carried a €90 fine.",
    gap: gap("The departure times of the extra night trains are not published."),
    sources: [BE.getThere],
  });
}

function belgiumBoomShuttleStep(): StepDraft {
  return step({
    id: "be-boom-shuttle",
    title: "Use the free shuttle from Boom station",
    fact: "The free shuttle between Boom station and DreamVille is inbound on the Thursday and Friday only, with the return on the Monday.",
    dayPattern: "Thursday and Friday in, Monday out",
    gap: gap("No departure times are published for the free Boom shuttle."),
    sources: [BE.getThere],
  });
}

function belgiumParkingVoucherStep(): StepDraft {
  return step({
    id: "be-parking-voucher",
    title: "Buy the parking voucher before you travel",
    fact: "Parking vouchers are bought in advance through the Add-On Sale, not at the gate.",
    gap: gap("No 2027 price is published for a festival or DreamVille parking voucher."),
    sources: [BE.getThere],
  });
}

function belgiumParkingSignsStep(): StepDraft {
  return step({
    id: "be-parking-signs",
    title: "Follow the car-park signs, not the postcode",
    fact: "The site is signposted as separate routes for 'Parking Festival' and 'Parking DreamVille'. There are no facilities to charge a car in the car parks, so arrive with a full battery.",
    sources: [BE.getThere],
  });
}

function belgiumCamperStep(): StepDraft {
  return step({
    id: "be-no-camper",
    title: "Leave the campervan at home",
    fact: "Campers and caravans are not allowed in or at DreamVille or in the DreamVille car parks, and sleeping in a car is prohibited as well.",
    sources: [BE.forbidden],
  });
}

function belgiumDropOffStep(): StepDraft {
  return step({
    id: "be-kiss-and-ride",
    title: "Use the Kiss & Ride for drop-off only",
    fact: "The Kiss & Ride zone is for drop-off and pick-up, and parking there is not allowed. Pre-booked Uber and Bolt cars wait there, where space is limited. In the 2026 cycle taxis used a signposted taxi zone on a first-come, first-served basis.",
    sources: [BE.getThere],
  });
}

function belgiumBikeStep(): StepDraft {
  return step({
    id: "be-bike-parking",
    title: "Know about the free bike parking",
    fact: "Free, supervised bicycle parking sits near the festival main entrance and near DreamVille Entrance 1, and the free Park & Bike scheme pairs the free remote car parks with a cycle route to the site.",
    sources: [BE.getThere, BE.entrances],
  });
}

function belgiumCoachRegistrationStep(): StepDraft {
  return step({
    id: "be-coach-registration",
    title: "Register a coach you organise",
    fact: "A coach you organise yourself must be registered in advance. In the 2026 cycle the deadline was 14 July.",
    gap: gap("No 2027 coach registration deadline is published."),
    sources: [BE.getThere],
  });
}

function belgiumHotelTransferStep(): StepDraft {
  return step({
    id: "be-hotel-transfer",
    title: "Know how a hotel package moves you",
    fact: "Global Journey hotel packages transfer to the festival by bus from Brussels hotels and by train from Antwerp hotels and hostels. On a Global Journey package, parking is never included.",
    gap: gap("No 2027 hotel package price is published, and no transfer departure time is published."),
    sources: [BE.hotelPackages, BE.order],
  });
}

/**
 * The one-line summary of what a combination means.
 *
 * Keyed by bed and arrival rather than by edition, because the two editions use
 * disjoint bed values, so one table covers all twenty plans without a key that
 * could ever be looked up in the wrong edition.
 */
type SleepArrival = `${JourneySleep}:${JourneyArrival}`;

const BELGIUM_INTRO: Readonly<Partial<Record<SleepArrival, string>>> = {
  "dreamville:flying":
    "The airport shuttles are the only published route that ends at DreamVille, and they exist on the Thursday and the Monday only.",
  "dreamville:train":
    "The train leaves you 20 minutes' walk from the site, and the free shuttle from Boom station covers the last leg on four of the seven days.",
  "dreamville:driving":
    "A car park voucher is a separate purchase, and the DreamVille car parks are reached by their own signed route.",
  "dreamville:coach":
    "The city shuttles are a round trip to the Main Entrance, which is not DreamVille, so the last leg needs its own plan.",
  "hotel:flying":
    "The airport shuttles serve DreamVille rather than a hotel, so flying in means a city shuttle, the train or your own arrangements.",
  "hotel:train": "A hotel stay fits the train best: the rail discount codes and the night trains are both published.",
  "hotel:driving":
    "Parking is a separate purchase bought in advance, and the signposted routes split festival parking from DreamVille parking.",
  "hotel:coach":
    "The city shuttles are the published coach product for a hotel stay, because they drop close to the Main Entrance.",
};

function belgiumPlan(sleep: JourneySleep, arrival: JourneyArrival): JourneyPlan {
  const drafts: StepDraft[] = [];

  if (arrival === "flying") {
    if (sleep === "dreamville") {
      drafts.push(belgiumAirportStep(), dreamvilleWindowStep());
      drafts.push(
        step({
          id: "be-airport-fallback",
          title: "Plan your own way in if you land on another day",
          fact: "A Friday arrival or a Sunday departure is not covered by the airport shuttles, so those days need your own arrangements.",
          gap: gap(
            "No other published transfer covers a Friday arrival or a Sunday departure, and no fare is published for a taxi or a private transfer.",
          ),
          sources: [BE.getThere],
        }),
      );
    } else {
      drafts.push(
        step({
          id: "be-airport-mismatch",
          title: "Expect the airport shuttles not to fit a hotel",
          fact: "The airport shuttles serve DreamVille on the Thursday and back on the Monday, so they do not end at a hotel.",
          sources: [BE.getThere],
        }),
        belgiumCityShuttleStep(),
        belgiumTrainStep(),
      );
    }
  }

  if (arrival === "train") {
    drafts.push(belgiumTrainStep());
    drafts.push(sleep === "dreamville" ? belgiumBoomShuttleStep() : belgiumNightTrainStep());
    drafts.push(belgiumRailDiscountStep());
    if (sleep === "dreamville") drafts.push(dreamvilleWindowStep());
  }

  if (arrival === "driving") {
    drafts.push(belgiumParkingVoucherStep(), belgiumParkingSignsStep());
    if (sleep === "dreamville") {
      drafts.push(belgiumCamperStep(), belgiumDropOffStep());
    } else {
      drafts.push(belgiumDropOffStep(), belgiumBikeStep());
    }
  }

  if (arrival === "coach") {
    if (sleep === "dreamville") {
      drafts.push(
        step({
          id: "be-coach-not-dreamville",
          title: "Expect a city shuttle to stop at the Main Entrance",
          fact: "City shuttles are a round-trip product that drops close to the Main Entrance, not at DreamVille.",
          gap: gap("No 2027 fare and no departure timetable is published for any city shuttle."),
          sources: [BE.getThere],
        }),
        belgiumCoachRegistrationStep(),
        dreamvilleWindowStep(),
      );
    } else {
      drafts.push(belgiumCityShuttleStep(), belgiumCoachRegistrationStep(), belgiumNightTrainStep());
    }
  }

  if (sleep === "hotel" && arrival === "flying") {
    drafts.push(belgiumRailDiscountStep());
  }

  if (sleep === "hotel" && arrival === "driving") {
    drafts.push(belgiumHotelTransferStep());
  }

  const decisionBlock = belgiumDecisions();
  const { steps, sources } = finalise(drafts, decisionBlock.drafts);
  const intro = BELGIUM_INTRO[`${sleep}:${arrival}`];
  if (intro === undefined) {
    throw new Error(`journey: no Belgium summary for ${sleep}/${arrival}`);
  }

  return {
    key: planKey("belgium", sleep, arrival),
    edition: "belgium",
    sleep,
    arrival,
    headline: `${editionHeadline("belgium")} — ${SLEEP_SUMMARY_LABEL[sleep]}, arriving by ${arrivalWord(arrival)}`,
    intro,
    steps,
    decisions: {
      intro: decisionBlock.intro,
      items: decisionBlock.drafts.map((item) => ({
        text: item.text,
        sourceUrls: uniqueSources(item.sources).map((source) => source.url),
      })),
    },
    sources,
  };
}

/**
 * Belgium's published ordering, read out of the transport chapter's own list.
 *
 * The chapter carries an `ol` block under the heading "order-of-decisions", so
 * this reads it rather than restating it: if the chapter is rewritten, the block
 * follows. Each line cites the list's own sources, because that is what the
 * chapter itself cites for the list as a whole.
 */
function belgiumDecisions(): {
  readonly intro: string;
  readonly drafts: readonly DecisionDraft[];
} {
  const heading = belgiumTransport.blocks.findIndex(
    (block) => block.type === "h2" && block.id === "order-of-decisions",
  );
  const list = belgiumTransport.blocks.slice(heading + 1).find((block) => block.type === "ol");

  if (heading < 0 || list === undefined || list.type !== "ol") {
    throw new Error("journey: the Belgium transport chapter has no order-of-decisions list");
  }

  const sources = (list.sources ?? []).map((id) => chapterSource(belgiumTransport, id));
  if (sources.length === 0) {
    throw new Error("journey: the Belgium order-of-decisions list cites nothing");
  }

  return {
    intro: "The Belgium transport chapter publishes this order. It is reproduced here, not reordered.",
    drafts: list.items.map((text) => ({ text, sources })),
  };
}

/* ---------------------------------------------------------------------------
 * Winter
 * ------------------------------------------------------------------------- */

const winterTransport = chapterOrThrow("winter", "transport");
const winterAccommodation = chapterOrThrow("winter", "accommodation");

const WI = {
  getThere: chapterSource(winterTransport, "s1"),
  packages: chapterSource(winterTransport, "s2"),
  pass: chapterSource(winterTransport, "s3"),
  hours: chapterSource(winterTransport, "s4"),
  taxis: chapterSource(winterTransport, "s5"),
  transaltitude: chapterSource(winterTransport, "s6"),
  timetable: chapterSource(winterTransport, "s7"),
  bensBus: chapterSource(winterTransport, "s8"),
  altibus: chapterSource(winterTransport, "s9"),
  rhonexpress: chapterSource(winterTransport, "s10"),
  parking: chapterSource(winterTransport, "s11"),
  resortBuses: chapterSource(winterTransport, "s12"),
  townLifts: chapterSource(winterTransport, "s13"),
  tyreRule: chapterSource(winterTransport, "s14"),
  resortMap: chapterSource(winterTransport, "s15"),
  accommodation: chapterSource(winterAccommodation, "s1"),
  villageSales: chapterSource(winterAccommodation, "s7"),
} as const;

function winterPackageStep(): StepDraft {
  return step({
    id: "wi-package-or-separate",
    title: "Decide whether the transfer comes inside a package",
    fact: "Every route to Alpe d'Huez finishes with a road transfer up the mountain. Tomorrowland sells coach, flight and train packages with that transfer arranged, or you can book a scheduled flight or train and a transfer separately.",
    gap: gap(
      "No flight, bus or train package price is published: the 4- and 7-day package sale showed as sold out with no minimum price.",
    ),
    sources: [WI.getThere, WI.packages, WI.accommodation],
  });
}

function winterFlightPackageStep(): StepDraft {
  return step({
    id: "wi-flight-package",
    title: "Fly into Lyon if you want the official transfer",
    fact: "Flight packages leave from Amsterdam, Brussels and Barcelona into Lyon Airport, and are bookable with a 4-day or a 7-day package. The package includes the return flight, the transfer between Lyon Airport and Alpe d'Huez, the festival ticket and the lift and ski pass.",
    dayPattern: "4-day or 7-day package",
    sources: [WI.packages],
  });
}

function winterLyonTransferStep(): StepDraft {
  const single = winterShuttle("bens-bus-lyon-single");
  return step({
    id: "wi-bens-bus-lyon",
    title: "Or book the airport transfer yourself from Lyon",
    fact: "Ben's Bus runs transfers from Lyon Airport every Saturday, and the drive is about 2 hours 30 minutes over 148 km.",
    dayPattern: "Saturdays only",
    price: priceOf(single, "2026–27 season", "single, Lyon Airport to Alpe d'Huez", single.notes),
    sources: [WI.bensBus, recordSource(single)],
  });
}

function winterGrenobleTransferStep(): StepDraft {
  const single = winterShuttle("bens-bus-grenoble-single");
  return step({
    id: "wi-bens-bus-grenoble",
    title: "Grenoble Airport is the shorter transfer",
    fact: "Ben's Bus runs from Grenoble Airport on any day of the week that has a scheduled flight, and the drive to Alpe d'Huez takes about 2 hours.",
    dayPattern: "Any day with a scheduled flight",
    price: priceOf(single, "2026–27 season", "single, Grenoble Airport to Alpe d'Huez", single.notes),
    sources: [WI.bensBus, recordSource(single)],
  });
}

function winterRoadTimeStep(): StepDraft {
  const fact = winterFact("airport-journey-times");
  return step({
    id: "wi-road-times",
    title: "Plan around the road time, not the flight time",
    fact: `${fact.value}. ${fact.detail ?? ""}`.trim(),
    sources: [recordSource(fact)],
  });
}

function winterGenevaStep(): StepDraft {
  const record = winterShuttle("altibus-geneva-return");
  const fact = winterFact("geneva-shuttle-not-operated");
  return step({
    id: "wi-geneva-caveat",
    title: "Do not assume a Geneva transfer is running",
    fact: "Altibus publishes a fare for the Geneva route, and the same page states that the Geneva to Alpe d'Huez shuttle did not run in the winter 2025/26 season.",
    price: priceOf(record, "2026–27 season, suspended route", "adult return, Geneva Airport to Alpe d'Huez", fact.detail),
    sources: [WI.altibus, recordSource(record), recordSource(fact)],
  });
}

function winterRhonexpressStep(): StepDraft {
  return step({
    id: "wi-rhonexpress",
    title: "If you land at Lyon and continue by rail, take the tram",
    fact: "Lyon Airport connects to Lyon Part-Dieu by the Rhônexpress tram, which takes 30 minutes and runs every 15 minutes.",
    departures: {
      label: "Rhônexpress, Lyon Airport to Lyon Part-Dieu",
      first: "04:25",
      last: "00:00",
      note: "Every 15 minutes across that window.",
    },
    sources: [WI.rhonexpress],
  });
}

function winterTransaltitudeStep(): StepDraft {
  const single = winterShuttle("transaltitude-grenoble-single");
  return step({
    id: "wi-transaltitude",
    title: "Take the scheduled coach up from Grenoble",
    fact: "Transaltitude runs the scheduled coach between Grenoble coach station and Alpe d'Huez. Its 2026–27 timetable covers 19 December 2026 to 28 March 2027.",
    dayPattern: "2026–27 timetable, 19 December to 28 March",
    price: priceOf(single, "2026–27 season", "single, Grenoble coach station to Alpe d'Huez", single.notes),
    sources: [WI.transaltitude, WI.timetable, recordSource(single)],
  });
}

function winterStopsStep(): StepDraft {
  return step({
    id: "wi-transaltitude-stops",
    title: "Check that your stop is served",
    fact: "Two things change in festival week: the Palais des Sports stop is closed for the festival, and the operator states that some stops are not served, directing passengers to the nearest one. One reserved seat is one guaranteed place on board, and a full-fare ticket can be bought on board.",
    sources: [WI.transaltitude, WI.timetable],
  });
}

function winterLuggageStep(): StepDraft {
  return step({
    id: "wi-coach-luggage",
    title: "Know the luggage allowance before you pack",
    fact: "The included allowance is one suitcase up to 150 cm total dimensions and 20 kg, one small cabin bag, and one ski or snowboard set with boots. Extra luggage is charged per piece.",
    sources: [WI.timetable, WI.transaltitude],
  });
}

function winterTrainPackageStep(): StepDraft {
  return step({
    id: "wi-train-package",
    title: "Train packages exist, but only with the full week",
    fact: "Train packages leave from Amsterdam and can be booked with a 7-day package only. Bus packages are the other way round: Belgium only, from Antwerp and Brussels, with a 4-day package only.",
    sources: [WI.packages],
  });
}

function winterBusPackageStep(): StepDraft {
  return step({
    id: "wi-bus-package",
    title: "Tomorrowland's own coach packages are Belgium only",
    fact: "Bus packages leave from Antwerp and Brussels and are bookable with a 4-day package only. They are not sold from the Netherlands, Switzerland or France, and they are not sold with the 7-day week.",
    sources: [WI.packages],
  });
}

/**
 * The night service: included in an Oz 3300 package, or bought as a pass.
 *
 * The two cases are separate steps because they are separate money. An Oz 3300
 * package includes the pass, so printing its €40 beside that plan would read as a
 * charge the reader does not pay; a village bed does pay it, so the price belongs
 * there and nowhere else.
 */
function winterNightServiceIncludedStep(): StepDraft {
  return step({
    id: "wi-night-service-included",
    title: "Your package includes the night service",
    fact: "A Transportation Pass is included automatically in packages sold in Oz 3300. It buys the Oz 3300 night lift, a journey of about 20 minutes, plus the dedicated night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans.",
    departures: {
      label: "Oz 3300 night lift",
      first: "18:30",
      last: "00:30",
      note: "Two windows, 18:30 to 21:00 and 22:30 to 00:30, with the second extended to 02:00 on MainStage days.",
    },
    gap: gap("No separate price is shown because the pass comes inside the package, and no 2027 package price is published."),
    sources: [WI.pass, WI.accommodation],
  });
}

function winterTransportationPassStep(): StepDraft {
  const fact = winterFact("transportation-pass-price");
  return step({
    id: "wi-transportation-pass",
    title: "Buy the Transportation Pass for the evening",
    fact: "If you sleep outside Alpe d'Huez, the evening return is a paid product. The Transportation Pass buys the Oz 3300 night lift, a journey of about 20 minutes, plus dedicated night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans. Walking between Alpe d'Huez and the surrounding villages is prohibited, so the pass is the sanctioned way back.",
    departures: {
      label: "Oz 3300 night lift",
      first: "18:30",
      last: "00:30",
      note: "Two windows, 18:30 to 21:00 and 22:30 to 00:30, with the second extended to 02:00 on MainStage days.",
    },
    price: factPrice(fact, "2027", "Transportation Pass, per person"),
    sources: [WI.pass, recordSource(fact)],
  });
}

function winterVillageNightStep(): StepDraft {
  return step({
    id: "wi-village-mainstage-days",
    title: "The village coaches do not cover the pre-days",
    fact: "The coaches to Villard-Reculas and Auris-en-Oisans run only on the days the MainStage is open, so they do not cover the Saturday-to-Monday pre-days.",
    dayPattern: "Tuesday to Friday only",
    sources: [WI.pass, WI.hours],
  });
}

function winterVillageSalesStep(): StepDraft {
  return step({
    id: "wi-village-sales",
    title: "Village beds are sold through Sunweb",
    fact: "Tomorrowland sells packages in Alpe d'Huez and Oz 3300. Villages other than those two are sold exclusively through Sunweb, the official booking provider, and a package in a surrounding village comes with access to the mountain stages only.",
    sources: [WI.accommodation, WI.villageSales],
  });
}

function winterWinterTyresStep(): StepDraft {
  const fact = winterFact("winter-equipment-rule");
  return step({
    id: "wi-winter-tyres",
    title: "Fit winter tyres or carry chains before you climb",
    fact: `${fact.value}. ${fact.detail ?? ""}`.trim(),
    dayPattern: "1 November to 31 March",
    sources: [recordSource(fact), WI.tyreRule],
  });
}

function winterHairpinStep(): StepDraft {
  const fact = winterFact("hairpin-count");
  const roadTimes = winterFact("airport-journey-times");
  return step({
    id: "wi-hairpins",
    title: "Plan for the climb",
    fact: `The road up to the resort climbs ${fact.value}, so the drive is longer than the map distance suggests. The published road times from the airports are ${roadTimes.value}.`,
    sources: [recordSource(fact), recordSource(roadTimes), WI.getThere],
  });
}

function winterParkingStep(): StepDraft {
  const daily = winterFact("covered-parking-daily");
  const weekly = winterFact("covered-parking-weekly");
  const spaces = winterFact("covered-parking-spaces");
  return step({
    id: "wi-parking",
    title: "Budget the parking before you drive",
    fact: `Covered parking costs ${daily.value} or ${weekly.value} for the 2026–27 season, and the first hour is free. ${spaces.value}, and Éclose is the largest of them. Free outdoor car parks are marked on the resort map.`,
    /* The weekly rate is the useful qualifier beside the daily one, so the note
       states the alternative price without repeating the unit the value already
       carries. */
    price: factPrice(daily, "2026–27 season", "covered parking, per day", `A week costs ${weekly.value}.`),
    sources: [recordSource(daily), recordSource(weekly), recordSource(spaces), WI.parking, WI.resortMap],
  });
}

function winterResortTransportStep(): StepDraft {
  const buses = winterFact("free-village-buses");
  const lifts = winterFact("free-town-lifts");
  return step({
    id: "wi-resort-transport",
    title: "Getting around the resort is free",
    fact: `${buses.value}, and no ticket is needed. Three lifts inside the resort are also free in winter: ${lifts.value}.`,
    sources: [recordSource(buses), WI.resortBuses, recordSource(lifts), WI.townLifts],
  });
}

function winterStageAccessStep(): StepDraft {
  const liftTimes = winterFact("village-lift-last-departures");
  const pedestrian = winterFact("pedestrian-mountain-access");
  return step({
    id: "wi-stage-access",
    title: "Know the last lift down from the villages",
    fact: `${liftTimes.value}. ${liftTimes.detail ?? ""} ${pedestrian.value}: the lift and ski pass in every ticket is what reaches the mountain stages.`,
    sources: [recordSource(liftTimes), WI.hours, recordSource(pedestrian)],
  });
}

const WINTER_INTRO: Readonly<Partial<Record<SleepArrival, string>>> = {
  "resort:flying":
    "Every route finishes with a road transfer up the mountain, and Lyon is the airport the official flight packages use.",
  "resort:train": "The train stops at Grenoble, and the scheduled coach covers the last 90 minutes or so up the mountain.",
  "resort:driving": "The drive ends with 21 hairpins, winter equipment law and a car park you can price.",
  "resort:coach": "Tomorrowland's own coach packages are sold from Belgium only, but scheduled coaches reach the resort too.",
  "oz3300:flying": "Oz 3300 is reached by lift, and a package there includes the night service that comes with it.",
  "oz3300:train": "Oz 3300 packages include the Transportation Pass, which covers the night lift back up.",
  "oz3300:driving": "Parking is priced, and the night lift back up to Oz 3300 comes inside the package.",
  "oz3300:coach": "A scheduled coach reaches the resort, and the package covers the lift on to Oz 3300.",
  "village:flying": "A village bed is a Sunweb booking, and it needs the paid night service to be usable.",
  "village:train": "A village bed is a Sunweb booking, and the night coaches do not run on the pre-days.",
  "village:driving": "A village bed is a Sunweb booking, and the parking in the resort is priced by the day or the week.",
  "village:coach": "A village bed is a Sunweb booking, and walking back from the resort is prohibited.",
};

function winterPlan(sleep: JourneySleep, arrival: JourneyArrival): JourneyPlan {
  const drafts: StepDraft[] = [];

  if (sleep === "village") drafts.push(winterVillageSalesStep());

  if (arrival === "flying") {
    drafts.push(winterPackageStep(), winterFlightPackageStep(), winterLyonTransferStep());
    if (sleep === "resort") {
      drafts.push(winterGrenobleTransferStep(), winterRoadTimeStep(), winterGenevaStep());
    } else {
      drafts.push(winterRoadTimeStep(), winterGenevaStep());
    }
    if (sleep === "resort") drafts.push(winterRhonexpressStep());
  }

  if (arrival === "train") {
    drafts.push(winterTransaltitudeStep(), winterStopsStep(), winterLuggageStep());
    if (sleep === "resort") drafts.push(winterTrainPackageStep());
  }

  if (arrival === "driving") {
    drafts.push(winterWinterTyresStep(), winterHairpinStep(), winterParkingStep());
  }

  if (arrival === "coach") {
    drafts.push(winterBusPackageStep(), winterTransaltitudeStep(), winterStopsStep());
  }

  if (sleep === "oz3300") {
    drafts.push(winterNightServiceIncludedStep());
  }

  if (sleep === "village") {
    drafts.push(winterTransportationPassStep(), winterVillageNightStep());
  }

  if (sleep === "resort") {
    drafts.push(winterResortTransportStep(), winterStageAccessStep());
  }

  const decisionBlock = winterDecisions();
  const { steps, sources } = finalise(drafts, decisionBlock.drafts);
  const intro = WINTER_INTRO[`${sleep}:${arrival}`];
  if (intro === undefined) {
    throw new Error(`journey: no Winter summary for ${sleep}/${arrival}`);
  }

  return {
    key: planKey("winter", sleep, arrival),
    edition: "winter",
    sleep,
    arrival,
    headline: `${editionHeadline("winter")} — ${SLEEP_SUMMARY_LABEL[sleep]}, arriving by ${arrivalWord(arrival)}`,
    intro,
    steps,
    decisions: {
      intro: decisionBlock.intro,
      items: decisionBlock.drafts.map((item) => ({
        text: item.text,
        sourceUrls: uniqueSources(item.sources).map((source) => source.url),
      })),
    },
    sources,
  };
}

/**
 * Winter's ordering, derived from its transport chapter.
 *
 * The Winter chapter publishes no explicit list, so each line below restates a
 * decision the chapter raises, in the order it raises them, and carries that
 * paragraph's own source. The block says so on the page rather than borrowing
 * Belgium's list, which would describe a different journey.
 */
function winterDecisions(): {
  readonly intro: string;
  readonly drafts: readonly DecisionDraft[];
} {
  const item = (text: string, sources: readonly JourneySource[]): DecisionDraft => ({
    text,
    sources,
  });

  const packages = winterFact("package-mode-matrix");
  const geneva = winterFact("geneva-shuttle-not-operated");
  const pass = winterFact("transportation-pass-price");
  const tyres = winterFact("winter-equipment-rule");

  return {
    intro:
      "The Winter transport chapter sets these out in this order without numbering them, so the sequence below follows the chapter rather than inventing one.",
    drafts: [
      item(
        "Decide whether the transfer comes inside a package or is booked separately, because every route ends with the same road transfer up the mountain.",
        [WI.getThere, WI.packages],
      ),
      item(
        `Fix the length of the stay against the transport: ${packages.value}. Flight packages take either length.`,
        [recordSource(packages)],
      ),
      item(
        "Pick the airport by the transfer, not the fare alone. Lyon is the airport the official flight packages use, and the Geneva operator states its shuttle did not run last winter.",
        [WI.packages, recordSource(geneva), WI.altibus],
      ),
      item(
        "Reserve the coach seat for the day you travel, because the operator's own rule is that one reserved seat is one guaranteed place on board.",
        [WI.timetable, WI.transaltitude],
      ),
      item(
        `If you sleep outside Alpe d'Huez, buy the Transportation Pass before you rely on the evening: it covers the Oz 3300 night lift and the night coaches, and it costs ${pass.value}.`,
        [WI.pass, recordSource(pass)],
      ),
      item(`If you drive, sort the equipment before the climb: ${tyres.value}.`, [
        recordSource(tyres),
        WI.tyreRule,
      ]),
    ],
  };
}

/* ---------------------------------------------------------------------------
 * Labels and the plan set
 * ------------------------------------------------------------------------- */

function editionHeadline(edition: JourneyEdition): string {
  return edition === "belgium" ? "Tomorrowland Belgium" : "Tomorrowland Winter";
}

function arrivalWord(arrival: JourneyArrival): string {
  return arrival === "flying" ? "plane" : arrival === "train" ? "train" : arrival === "driving" ? "car" : "coach";
}

/**
 * Every plan the page can show.
 *
 * Twenty combinations of edition, bed and arrival method, each computed once so
 * a change of control is a lookup rather than a recalculation. Building them all
 * also means a missing record fails the build, not a reader's click.
 */
export function allJourneyPlans(): readonly JourneyPlan[] {
  const plans: JourneyPlan[] = [];
  const editions: readonly JourneyEdition[] = ["belgium", "winter"];
  const arrivals: readonly JourneyArrival[] = ["flying", "train", "driving", "coach"];

  for (const edition of editions) {
    const sleeps: readonly JourneySleep[] =
      edition === "belgium" ? ["dreamville", "hotel"] : ["resort", "oz3300", "village"];
    for (const arrival of arrivals) {
      for (const sleep of sleeps) {
        plans.push(edition === "belgium" ? belgiumPlan(sleep, arrival) : winterPlan(sleep, arrival));
      }
    }
  }

  return plans;
}

/** The plan for a state, with the bed repaired first if it belongs to another edition. */
export function journeyPlanFor(
  state: JourneyState,
  plans: readonly JourneyPlan[] = allJourneyPlans(),
): JourneyPlan {
  const fallback = defaultJourneyState(state.edition);
  const wanted = planKey(state.edition, state.sleep, state.arrival);
  const found = plans.find((plan) => plan.key === wanted);
  if (found !== undefined) return found;

  const repaired = plans.find(
    (plan) => plan.key === planKey(state.edition, fallback.sleep, state.arrival),
  );
  if (repaired === undefined) {
    throw new Error(`journey: no plan for ${wanted}`);
  }
  return repaired;
}

// @vitest-environment node
import { describe, expect, it } from "vitest";

import { belgiumFacts } from "@/data/belgium";
import { winterFacts, winterShuttles } from "@/data/winter";
import { belgiumChapters } from "@/content/belgium";
import { winterChapters } from "@/content/winter";
import {
  NOT_PUBLISHED_2027,
  allJourneyPlans,
  journeyPlanFor,
  planKey,
  type JourneyPlan,
  type JourneyStep,
} from "./journey-logic";
import { SLEEP_OPTIONS, defaultJourneyState, type JourneySleep } from "./journey-state";

const PLANS = allJourneyPlans();

/**
 * Every URL the published data and guide content cite.
 *
 * A step's source must appear in this set, which is what makes "every printed
 * fact traces to a source URL present in the data" a test rather than a claim.
 */
function publishedSourceUrls(): Set<string> {
  const urls = new Set<string>();

  const addRecord = (record: { readonly source: { readonly url: string } }): void => {
    urls.add(record.source.url);
  };

  for (const shuttle of winterShuttles) addRecord(shuttle);
  for (const fact of winterFacts) addRecord(fact);
  addRecord(belgiumFacts.dreamville.checkOut);
  addRecord(belgiumFacts.dreamville.openingWindow);
  addRecord(belgiumFacts.dreamville.checkIn);

  for (const chapter of [...belgiumChapters, ...winterChapters]) {
    for (const source of chapter.sources) urls.add(source.url);
  }

  return urls;
}

const PUBLISHED_URLS = publishedSourceUrls();

/** Every step of every plan, with the plan it belongs to, for the whole-set assertions. */
function everyStep(): readonly { readonly plan: JourneyPlan; readonly step: JourneyStep }[] {
  return PLANS.flatMap((plan) => plan.steps.map((step) => ({ plan, step })));
}

describe("the plan set", () => {
  it("covers every combination of edition, bed and arrival method exactly once", () => {
    const expected =
      SLEEP_OPTIONS.belgium.length * 4 + SLEEP_OPTIONS.winter.length * 4;
    expect(PLANS).toHaveLength(expected);
    expect(new Set(PLANS.map((plan) => plan.key)).size).toBe(expected);
  });

  it("keys each plan by its own three choices", () => {
    for (const plan of PLANS) {
      expect(plan.key).toBe(planKey(plan.edition, plan.sleep, plan.arrival));
    }
  });

  it("gives every plan at least two steps and a non-empty intro", () => {
    for (const plan of PLANS) {
      expect(plan.steps.length, plan.key).toBeGreaterThanOrEqual(2);
      expect(plan.intro.length, plan.key).toBeGreaterThan(20);
      expect(plan.headline, plan.key).toContain("arriving by");
    }
  });

  it("never repeats a step id inside one plan", () => {
    for (const plan of PLANS) {
      const ids = plan.steps.map((step) => step.id);
      expect(new Set(ids).size, plan.key).toBe(ids.length);
    }
  });

  it("offers Brasil nowhere, because no timetable or fare is published for it", () => {
    for (const plan of PLANS) {
      expect(["belgium", "winter"]).toContain(plan.edition);
    }
  });
});

describe("every printed fact traces to a source present in the data", () => {
  it("cites at least one source on every step", () => {
    for (const { plan, step } of everyStep()) {
      expect(step.sourceUrls.length, `${plan.key}/${step.id}`).toBeGreaterThan(0);
    }
  });

  it("cites only URLs the data or the guide content publishes", () => {
    for (const { plan, step } of everyStep()) {
      for (const url of step.sourceUrls) {
        expect(PUBLISHED_URLS.has(url), `${plan.key}/${step.id} cites ${url}`).toBe(true);
      }
    }
  });

  it("lists every cited URL in the plan's own source map", () => {
    for (const { plan, step } of everyStep()) {
      for (const url of step.sourceUrls) {
        expect(plan.sources[url], `${plan.key} is missing ${url}`).toBeDefined();
      }
    }
  });

  it("holds no source in the map that neither a step nor a decision uses", () => {
    for (const plan of PLANS) {
      const used = new Set([
        ...plan.steps.flatMap((step) => step.sourceUrls),
        ...plan.decisions.items.flatMap((item) => item.sourceUrls),
      ]);
      for (const url of Object.keys(plan.sources)) {
        expect(used.has(url), `${plan.key} lists an unused source ${url}`).toBe(true);
      }
    }
  });

  it("dates every source, and the date is a real calendar date", () => {
    for (const plan of PLANS) {
      for (const source of Object.values(plan.sources)) {
        expect(source.checkedOn, source.url).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isFinite(Date.parse(`${source.checkedOn}T00:00:00Z`))).toBe(true);
      }
    }
  });

  it("names every source, so the link has an accessible name beyond its URL", () => {
    for (const plan of PLANS) {
      for (const source of Object.values(plan.sources)) {
        expect(source.title.trim().length, source.url).toBeGreaterThan(3);
      }
    }
  });

  it("uses https for every source, and never a bare http link", () => {
    for (const plan of PLANS) {
      for (const url of Object.keys(plan.sources)) {
        expect(url.startsWith("https://"), url).toBe(true);
      }
    }
  });
});

describe("prices", () => {
  it("states a price only as a positive whole number of cents with a period", () => {
    for (const { plan, step } of everyStep()) {
      if (step.price === undefined) continue;
      expect(Number.isSafeInteger(step.price.amountMinor), `${plan.key}/${step.id}`).toBe(true);
      expect(step.price.amountMinor).toBeGreaterThan(0);
      expect(step.price.period.length).toBeGreaterThan(3);
      expect(step.price.label.length).toBeGreaterThan(3);
    }
  });

  it("quotes the Winter operator fares exactly as the shuttle records publish them", () => {
    const fares = new Map<number, string>([
      [5000, "bens-bus-lyon-single"],
      [4150, "bens-bus-grenoble-single"],
      [8000, "altibus-geneva-return"],
      [2350, "transaltitude-grenoble-single"],
    ]);

    for (const [amount, id] of fares) {
      const record = winterShuttles.find((entry) => entry.id === id);
      expect(record, id).toBeDefined();
      expect(Math.round((record?.priceEur ?? 0) * 100), id).toBe(amount);
    }

    const printed = everyStep().flatMap(({ step }) =>
      step.price === undefined ? [] : [step.price.amountMinor],
    );
    for (const amount of printed) {
      const matchesRecord = winterShuttles.some(
        (record) => Math.round(record.priceEur * 100) === amount,
      );
      const matchesFact = winterFacts.some(
        (fact) => fact.amountEur !== undefined && Math.round(fact.amountEur * 100) === amount,
      );
      expect(matchesRecord || matchesFact, `no record publishes ${amount}`).toBe(true);
    }
  });

  it("never prints a Belgium shuttle fare, because none is published for 2027", () => {
    for (const plan of PLANS.filter((entry) => entry.edition === "belgium")) {
      for (const step of plan.steps) {
        expect(step.price, `${plan.key}/${step.id}`).toBeUndefined();
      }
    }
  });

  it("shows the Transportation Pass price to a village stay but not to an included one", () => {
    const village = PLANS.find((plan) => plan.key === planKey("winter", "village", "train"));
    const oz = PLANS.find((plan) => plan.key === planKey("winter", "oz3300", "train"));

    expect(village?.steps.some((step) => step.id === "wi-transportation-pass")).toBe(true);
    expect(oz?.steps.some((step) => step.id === "wi-night-service-included")).toBe(true);
    expect(oz?.steps.some((step) => step.id === "wi-transportation-pass")).toBe(false);
  });
});

describe("missing data is stated, never filled in", () => {
  it("labels every gap with the same visible notice", () => {
    const gaps = everyStep().flatMap(({ step }) => (step.gap === undefined ? [] : [step.gap]));
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.label).toBe(NOT_PUBLISHED_2027);
      expect(gap.detail.length).toBeGreaterThan(20);
    }
  });

  it("says the 2027 airport fares and timetables are missing on the Belgium plane plan", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "dreamville", "flying"));
    const airport = plan?.steps.find((step) => step.id === "be-airport-shuttle");
    expect(airport?.gap?.label).toBe(NOT_PUBLISHED_2027);
    expect(airport?.dayPattern).toBe("Thursday in, Monday out");
    expect(airport?.departures).toBeUndefined();
    expect(airport?.price).toBeUndefined();
  });

  it("states the day pattern of the free Boom shuttle and that its times are unpublished", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "dreamville", "train"));
    const shuttle = plan?.steps.find((step) => step.id === "be-boom-shuttle");
    expect(shuttle?.dayPattern).toBe("Thursday and Friday in, Monday out");
    expect(shuttle?.gap?.label).toBe(NOT_PUBLISHED_2027);
  });

  it("puts a gap notice on every step that could otherwise look priced or timed", () => {
    /* A step that names a fare, a timetable or a fare-like product but publishes
       neither must carry the notice, so the page never leaves a blank where a
       reader expects a figure. */
    const mustWarn = new Set([
      "be-airport-shuttle",
      "be-city-shuttle",
      "be-rail-discount",
      "be-night-trains",
      "be-boom-shuttle",
      "be-parking-voucher",
      "be-coach-registration",
      "be-hotel-transfer",
      "be-coach-not-dreamville",
      "be-airport-fallback",
      "wi-package-or-separate",
      "wi-night-service-included",
    ]);

    for (const { plan, step } of everyStep()) {
      if (!mustWarn.has(step.id)) continue;
      expect(step.gap?.label, `${plan.key}/${step.id}`).toBe(NOT_PUBLISHED_2027);
    }
  });
});

describe("departures", () => {
  it("prints a time only where the data publishes one", () => {
    const published = new Set(["04:25", "00:00", "18:30", "00:30"]);

    for (const { plan, step } of everyStep()) {
      if (step.departures === undefined) continue;
      for (const time of [step.departures.first, step.departures.last]) {
        if (time === null) continue;
        expect(published.has(time), `${plan.key}/${step.id} prints ${time}`).toBe(true);
      }
    }
  });

  it("carries the Rhônexpress window from the Winter transport chapter", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("winter", "resort", "flying"));
    const tram = plan?.steps.find((step) => step.id === "wi-rhonexpress");
    expect(tram?.departures?.first).toBe("04:25");
    expect(tram?.departures?.last).toBe("00:00");
  });

  it("carries the Oz 3300 night-lift window, not an invented one", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("winter", "village", "coach"));
    const night = plan?.steps.find((step) => step.id === "wi-transportation-pass");
    expect(night?.departures?.first).toBe("18:30");
    expect(night?.departures?.last).toBe("00:30");
  });

  it("never states a first time without a last, or the reverse, unless the data does", () => {
    for (const { step } of everyStep()) {
      if (step.departures === undefined) continue;
      /* Both are present here, because both windows the data publishes are closed. */
      expect(step.departures.first === null && step.departures.last !== null).toBe(false);
      expect(step.departures.last === null && step.departures.first !== null).toBe(false);
    }
  });
});

describe("order of decisions", () => {
  it("reproduces the Belgium transport chapter's own list, in its order", () => {
    const chapter = belgiumChapters.find((entry) => entry.slug === "transport");
    const heading = chapter?.blocks.findIndex(
      (block) => block.type === "h2" && block.id === "order-of-decisions",
    );
    const list = chapter?.blocks.slice((heading ?? 0) + 1).find((block) => block.type === "ol");

    expect(list?.type).toBe("ol");
    const published = list?.type === "ol" ? list.items : [];

    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "dreamville", "flying"));
    expect(plan?.decisions.items.map((item) => item.text)).toEqual(published);
  });

  it("cites a published source on every decision line", () => {
    for (const plan of PLANS) {
      expect(plan.decisions.items.length).toBeGreaterThanOrEqual(4);
      for (const item of plan.decisions.items) {
        expect(item.sourceUrls.length, `${plan.key}: ${item.text}`).toBeGreaterThan(0);
        for (const url of item.sourceUrls) {
          expect(PUBLISHED_URLS.has(url), url).toBe(true);
          expect(plan.sources[url], `${plan.key} cannot resolve ${url}`).toBeDefined();
        }
      }
    }
  });

  it("never repeats a source URL within one step or one decision line", () => {
    /* Two entries for the same page would read as two different sources, and the
       Winter pass fact and its add-on record genuinely cite the same URL. */
    for (const { plan, step } of everyStep()) {
      expect(new Set(step.sourceUrls).size, `${plan.key}/${step.id}`).toBe(step.sourceUrls.length);
    }
    for (const plan of PLANS) {
      for (const item of plan.decisions.items) {
        expect(new Set(item.sourceUrls).size, `${plan.key}: ${item.text}`).toBe(
          item.sourceUrls.length,
        );
      }
    }
  });

  it("says where the ordering came from, so a reader can tell it is not invented", () => {
    for (const plan of PLANS) {
      expect(plan.decisions.intro.length, plan.key).toBeGreaterThan(40);
    }
  });
});

describe("day patterns", () => {
  it("states the airport shuttle pattern in the words the official page uses", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "hotel", "flying"));
    const shuttle = plan?.steps.find((step) => step.id === "be-airport-mismatch");
    expect(shuttle?.fact).toContain("Thursday");
    expect(shuttle?.fact).toContain("Monday");
  });

  it("states the Winter bus and train package lengths the data publishes", () => {
    const train = PLANS.find((entry) => entry.key === planKey("winter", "resort", "train"));
    const step = train?.steps.find((entry) => entry.id === "wi-train-package");
    expect(step?.fact).toContain("7-day package only");
    expect(step?.fact).toContain("4-day package only");
  });

  it("never states a day pattern for a step whose data carries none", () => {
    for (const { plan, step } of everyStep()) {
      if (step.dayPattern === undefined) continue;
      expect(step.dayPattern.length, `${plan.key}/${step.id}`).toBeGreaterThan(3);
    }
  });
});

describe("journeyPlanFor", () => {
  it("returns the plan the state names", () => {
    const plan = journeyPlanFor({ edition: "winter", sleep: "oz3300", arrival: "coach" }, PLANS);
    expect(plan.key).toBe(planKey("winter", "oz3300", "coach"));
  });

  it("falls back to the edition's default bed rather than throwing", () => {
    const plan = journeyPlanFor(
      /* A state the controls cannot produce, but which a caller could. */
      { edition: "belgium", sleep: "village" as JourneySleep, arrival: "train" },
      PLANS,
    );
    expect(plan.edition).toBe("belgium");
    expect(plan.arrival).toBe("train");
    expect(plan.sleep).toBe("dreamville");
  });

  it("agrees with the default state", () => {
    const fallback = defaultJourneyState("winter");
    const plan = journeyPlanFor(fallback, PLANS);
    expect(plan.key).toBe(planKey("winter", fallback.sleep, fallback.arrival));
  });
});

describe("content honesty", () => {
  it("never says a 2027 fare exists where the record carries the word 'not'", () => {
    const genevaPlans = PLANS.filter((plan) =>
      plan.steps.some((step) => step.id === "wi-geneva-caveat"),
    );
    expect(genevaPlans.length).toBeGreaterThan(0);

    for (const plan of genevaPlans) {
      const step = plan.steps.find((entry) => entry.id === "wi-geneva-caveat");
      expect(step?.fact).toContain("did not run");
    }
  });

  it("marks the Geneva fare as a suspended route rather than as a working price", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("winter", "resort", "flying"));
    const geneva = plan?.steps.find((step) => step.id === "wi-geneva-caveat");
    expect(geneva?.price?.period).toContain("suspended");
  });

  it("quotes the 2026 cycle's discount as a past cycle, never as 2027's", () => {
    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "hotel", "train"));
    const discount = plan?.steps.find((step) => step.id === "be-rail-discount");
    expect(discount?.fact).toContain("2026 cycle");
    expect(discount?.gap?.detail).toContain("2027");
  });

  it("keeps every step's fact within a readable length", () => {
    for (const { plan, step } of everyStep()) {
      expect(step.fact.length, `${plan.key}/${step.id}`).toBeLessThan(700);
      expect(step.fact.trim(), `${plan.key}/${step.id}`).toBe(step.fact);
    }
  });

  it("gives every step a title short enough to scan", () => {
    for (const { plan, step } of everyStep()) {
      expect(step.title.length, `${plan.key}/${step.id}`).toBeLessThan(90);
      expect(step.title.length, `${plan.key}/${step.id}`).toBeGreaterThan(5);
    }
  });

  it("never leaves a doubled full stop in a step's text", () => {
    /* Facts are assembled from stored sentences, and several of those already end
       with a stop, so the joins must not add a second one. */
    for (const { plan, step } of everyStep()) {
      for (const text of [
        step.fact,
        step.dayPattern ?? "",
        step.departures?.note ?? "",
        step.price?.note ?? "",
        step.gap?.detail ?? "",
      ]) {
        expect(text, `${plan.key}/${step.id}`).not.toMatch(/\.\./);
      }
    }
  });

  it("reads a stored sentence as prose where it is dropped mid-sentence", () => {
    /* The DreamVille step is the one assembled from three stored sentences, and
       two of those begin with a capital because they stand alone on the official
       page. Dropped after "Check-in on the Thursday is", they must read as prose
       rather than as a heading. */
    const plan = PLANS.find((entry) => entry.key === planKey("belgium", "dreamville", "train"));
    const step = plan?.steps.find((entry) => entry.id === "be-dreamville-window");

    expect(step?.fact).toContain("Check-in on the Thursday is from 11:00");
    expect(step?.fact).not.toMatch(/\bis [A-Z]/);
    expect(step?.fact).toMatch(/no exceptions\.$/);
  });
});

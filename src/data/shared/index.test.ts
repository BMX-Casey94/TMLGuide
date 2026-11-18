// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { faqSchema } from "../schemas/faq";
import { sharedData, validateSharedData } from "./index";
import {
  editionOverviewSchema,
  radioBroadcastSchema,
  radioChannelSchema,
  radioMilestoneSchema,
  radioStationSchema,
} from "./index";

const VERIFIED_ON = "2026-11-18";

function readLedger(): string {
  const root = process.cwd();
  return ["docs/factcheck/brasil-general.md", "docs/factcheck/conflicts.md"]
    .map((file) => readFileSync(path.join(root, file), "utf8"))
    .join("\n");
}

const ledger = readLedger();

/** Every shared record, flattened. */
const everyRecord = [
  sharedData.radio.station,
  ...sharedData.radio.milestones,
  ...sharedData.radio.channels,
  ...sharedData.radio.broadcasts,
  ...sharedData.editions,
  ...sharedData.faqs,
];

describe("Shared data — schema parsing", () => {
  it("parses the radio station", () => {
    expect(radioStationSchema.parse(sharedData.radio.station)).toEqual(sharedData.radio.station);
  });

  it("parses every radio milestone", () => {
    for (const record of sharedData.radio.milestones) {
      expect(radioMilestoneSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every radio channel", () => {
    for (const record of sharedData.radio.channels) {
      expect(radioChannelSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every radio broadcast", () => {
    for (const record of sharedData.radio.broadcasts) {
      expect(radioBroadcastSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every edition overview", () => {
    for (const record of sharedData.editions) {
      expect(editionOverviewSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every FAQ entry", () => {
    for (const record of sharedData.faqs) {
      expect(faqSchema.parse(record)).toEqual(record);
    }
  });

  it("produces the same result when validated again", () => {
    expect(validateSharedData()).toEqual(sharedData);
  });

  it("rejects an edition that ends before it starts", () => {
    const first = sharedData.editions[0];
    expect(
      editionOverviewSchema.safeParse({ ...first, startsOn: "2027-07-20", endsOn: "2027-07-18" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown key on an edition", () => {
    const first = sharedData.editions[0];
    expect(editionOverviewSchema.safeParse({ ...first, capacity: 60000 }).success).toBe(false);
  });
});

describe("Shared data — collection invariants", () => {
  it("keeps ids unique inside every collection", () => {
    for (const collection of [
      sharedData.radio.milestones,
      sharedData.radio.channels,
      sharedData.radio.broadcasts,
      sharedData.editions,
      sharedData.faqs,
    ]) {
      const ids = collection.map((record) => record.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("marks every record official", () => {
    for (const record of everyRecord) {
      expect(record.confidence).toBe("official");
    }
  });

  it("verifies every record on 2026-11-18", () => {
    for (const record of everyRecord) {
      expect(record.lastVerified).toBe(VERIFIED_ON);
      expect(record.source.retrievedOn).toBe(VERIFIED_ON);
    }
  });

  it("uses an https source url for every record", () => {
    for (const record of everyRecord) {
      expect(record.source.url.startsWith("https://")).toBe(true);
    }
  });

  it("cites only source urls that appear in the fact-check ledger", () => {
    const missing = everyRecord
      .map((record) => record.source.url)
      .filter((url) => !ledger.includes(url));
    expect(missing).toEqual([]);
  });

  it("resolves every related FAQ id", () => {
    const ids = new Set(sharedData.faqs.map((record) => record.id));
    for (const entry of sharedData.faqs) {
      for (const related of entry.related) {
        expect(ids.has(related)).toBe(true);
      }
    }
  });

  it("uses the all edition scope on every shared record", () => {
    for (const record of everyRecord) {
      expect(record.edition).toBe("all");
    }
  });
});

describe("Shared data — One World Radio", () => {
  it("uses the verified international stream url", () => {
    expect(sharedData.radio.station.streamUrl).toBe(
      "https://playerservices.streamtheworld.com/api/livestream-redirect/OWR_INTERNATIONAL.mp3",
    );
    const streamChannel = sharedData.radio.channels.find(
      (record) => record.kind === "stream",
    );
    expect(streamChannel?.url).toBe(sharedData.radio.station.streamUrl);
  });

  it("records the launch date", () => {
    const launch = sharedData.radio.milestones.find((record) => record.id === "launch");
    expect(launch?.happenedOn).toBe("2019-02-18");
  });

  it("never claims Romanian FM 92.1", () => {
    expect(JSON.stringify(sharedData.radio)).not.toContain("Romania");
    expect(JSON.stringify(sharedData.radio)).not.toContain("92.1");
  });

  it("treats Switzerland as online only", () => {
    const switzerland = sharedData.radio.broadcasts.find(
      (record) => record.country === "Switzerland",
    );
    expect(switzerland?.method).toBe("Online only");
    expect(switzerland?.detail).toContain("my105");
  });

  it("gives every broadcast a distinct country", () => {
    const countries = sharedData.radio.broadcasts.map((record) => record.country);
    expect(new Set(countries).size).toBe(countries.length);
  });
});

describe("Shared data — editions", () => {
  const edition = (id: string) => sharedData.editions.find((record) => record.id === id);

  it("records the Belgium 2027 weekends from the conflicts ledger", () => {
    expect(edition("belgium-2027")?.startsOn).toBe("2027-07-16");
    expect(edition("belgium-2027")?.endsOn).toBe("2027-07-18");
    expect(edition("belgium-2027-weekend-2")?.startsOn).toBe("2027-07-23");
    expect(edition("belgium-2027-weekend-2")?.endsOn).toBe("2027-07-25");
  });

  it("records Thailand as confirmed and sold out", () => {
    const thailand = edition("thailand-2026");
    expect(thailand?.startsOn).toBe("2026-12-11");
    expect(thailand?.endsOn).toBe("2026-12-13");
    expect(thailand?.status).toBe("sold-out");
    expect(thailand?.venue).toBe("Wisdom Valley");
  });

  it("records Brasil 2027", () => {
    const brasil = edition("brasil-2027");
    expect(brasil?.startsOn).toBe("2027-04-30");
    expect(brasil?.endsOn).toBe("2027-05-02");
    expect(brasil?.guideEdition).toBe("brasil");
  });

  it("records Winter only where the ledger confirms it", () => {
    expect(edition("winter-2027")?.startsOn).toBe("2027-03-20");
    expect(edition("winter-2027")?.endsOn).toBe("2027-03-27");
  });

  it("marks each edition with a single status", () => {
    for (const record of sharedData.editions) {
      expect(["past", "sold-out", "on-sale", "upcoming"]).toContain(record.status);
    }
  });

  it("links a guide edition only for the three editions the guide covers", () => {
    const guideEditions = new Set(
      sharedData.editions
        .map((record) => record.guideEdition)
        .filter((value): value is "belgium" | "winter" | "brasil" => value !== undefined),
    );
    expect(guideEditions).toEqual(new Set(["belgium", "winter", "brasil"]));
  });
});

describe("Shared data — general FAQs", () => {
  const faq = (id: string) => sharedData.faqs.find((record) => record.id === id);

  it("states the re-entry rule as OUT = OUT", () => {
    const reEntry = faq("re-entry");
    expect(reEntry?.answer).toContain("OUT = OUT");
    expect(reEntry?.answer).toContain("cannot re-enter on the same day");
  });

  it("names the Exchange Desk as the only official resale route", () => {
    const resale = faq("resale-exchange-desk");
    expect(resale?.answer).toContain("Exchange Desk is the only official way");
    expect(resale?.answer).toContain("TicketSwap");
    expect(resale?.answer).toContain("not official channels");
  });

  it("states the wristband identity rule", () => {
    const wristband = faq("wristband-id");
    expect(wristband?.answer).toContain("access can be refused");
    expect(wristband?.answer).toContain("cannot be changed");
  });

  it("explains Pearls without quoting a euro rate", () => {
    const pearls = faq("pearls");
    const answer = pearls?.answer ?? "";
    expect(answer).toContain("Pearls are the festival's own currency");
    expect(answer).not.toMatch(/€\s?\d/);
    expect(answer).not.toMatch(/\d+(?:\.\d+)?\s?(?:euro|EUR) per Pearl/i);
  });

  it("omits the Medallion four-ticket guarantee", () => {
    const text = JSON.stringify(sharedData.faqs);
    expect(text).not.toMatch(/guarantee[sd]? (?:to buy |you )?(?:two|2|four|4) /i);
    expect(text).not.toContain("four tickets");
    expect(text).not.toContain("4 tickets");
  });

  it("never publishes Astera or Romania as current offerings", () => {
    const text = JSON.stringify(sharedData);
    expect(text).not.toContain("Astera");
    expect(text).not.toContain("Romania");
  });
});

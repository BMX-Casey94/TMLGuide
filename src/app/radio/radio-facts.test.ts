import { describe, expect, it } from "vitest";
import { radioBroadcasts, radioChannels, radioMilestones } from "@/data/shared";
import {
  RADIO_CHANNEL_KIND_LABELS,
  RADIO_OFFICIAL_SITE,
  coverageSummary,
  isAudioStream,
  linkableRadioChannels,
  orderRadioBroadcasts,
  orderRadioChannels,
  orderRadioMilestones,
} from "./radio-facts";

describe("orderRadioChannels", () => {
  it("puts the direct stream first, then the web player, then apps", () => {
    const ordered = orderRadioChannels(radioChannels).map((channel) => channel.kind);
    expect(ordered[0]).toBe("stream");
    expect(ordered.indexOf("web")).toBeLessThan(ordered.indexOf("app"));
  });

  it("keeps every channel", () => {
    const ordered = orderRadioChannels(radioChannels);
    expect(ordered).toHaveLength(radioChannels.length);
    expect(new Set(ordered.map((channel) => channel.id))).toEqual(
      new Set(radioChannels.map((channel) => channel.id)),
    );
  });

  it("does not mutate the input", () => {
    const before = [...radioChannels];
    orderRadioChannels(radioChannels);
    expect(radioChannels).toEqual(before);
  });
});

describe("linkableRadioChannels", () => {
  it("keeps only channels with a URL a reader can open", () => {
    const linkable = linkableRadioChannels(radioChannels);
    expect(linkable.length).toBeGreaterThan(0);
    for (const channel of linkable) {
      expect(channel.url?.startsWith("https://")).toBe(true);
    }
  });

  it("drops the channels with no public endpoint, such as native apps and satellite", () => {
    const linkableIds = linkableRadioChannels(radioChannels).map((channel) => channel.id);
    for (const channel of radioChannels) {
      if (channel.url === undefined) expect(linkableIds).not.toContain(channel.id);
    }
  });
});

describe("orderRadioMilestones", () => {
  it("sorts oldest first", () => {
    const dates = orderRadioMilestones(radioMilestones).map((milestone) => milestone.happenedOn);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0]).toBe("2019-02-18");
  });
});

describe("orderRadioBroadcasts", () => {
  it("sorts countries alphabetically", () => {
    const countries = orderRadioBroadcasts(radioBroadcasts).map((broadcast) => broadcast.country);
    expect([...countries].sort((a, b) => a.localeCompare(b, "en-GB"))).toEqual(countries);
  });

  it("keeps every country", () => {
    expect(orderRadioBroadcasts(radioBroadcasts)).toHaveLength(radioBroadcasts.length);
  });
});

describe("coverageSummary", () => {
  it("counts the published countries and does not claim worldwide terrestrial coverage", () => {
    const summary = coverageSummary(radioBroadcasts);
    expect(summary).toContain(String(radioBroadcasts.length));
    expect(summary).toMatch(/listen online/i);
    expect(summary).not.toMatch(/every country/i);
  });

  it("uses the singular for one country", () => {
    expect(coverageSummary([radioBroadcasts[0]])).toContain("1 country");
  });

  it("is honest with no data", () => {
    expect(coverageSummary([])).toBe("No terrestrial carriage is published.");
  });
});

describe("channel kind labels", () => {
  it("labels every kind the schema allows", () => {
    for (const channel of radioChannels) {
      expect(RADIO_CHANNEL_KIND_LABELS[channel.kind].length).toBeGreaterThan(0);
    }
  });
});

describe("isAudioStream", () => {
  it("identifies the direct stream", () => {
    const stream = radioChannels.find((channel) => channel.kind === "stream");
    expect(isAudioStream(stream!)).toBe(true);
  });

  it("does not mistake the web player for the stream", () => {
    const web = radioChannels.find((channel) => channel.kind === "web");
    expect(isAudioStream(web!)).toBe(false);
  });
});

describe("official source", () => {
  it("is an https Tomorrowland host", () => {
    expect(RADIO_OFFICIAL_SITE).toMatch(/^https:\/\/[a-z0-9.-]*tomorrowland\.com/);
  });
});

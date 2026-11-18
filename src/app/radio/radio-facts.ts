import type {
  RadioBroadcast,
  RadioChannel,
  RadioChannelKind,
  RadioMilestone,
} from "@/data/shared/radio";

/**
 * Presentation rules for the One World Radio page.
 *
 * The page's job is to describe the station honestly and hand the reader the
 * official route to it. Everything shown comes from `src/data/shared/radio.ts`,
 * which is the only place a station claim is allowed to live; nothing here adds a
 * fact, and the helper functions below only choose an order and a label.
 */

/** Official station site, used for the source link and for "listen officially". */
export const RADIO_OFFICIAL_SITE = "https://oneworldradio.tomorrowland.com/";

export const RADIO_CHANNEL_KIND_LABELS: Record<RadioChannelKind, string> = {
  stream: "Direct stream",
  app: "App",
  web: "Website player",
  video: "Video",
  aggregator: "Aggregator",
  satellite: "Satellite radio",
};

/**
 * Kinds in the order a reader is most likely to want them: press play here,
 * then the app, then the things that need another service.
 */
const KIND_ORDER: readonly RadioChannelKind[] = [
  "stream",
  "web",
  "app",
  "video",
  "aggregator",
  "satellite",
];

/**
 * Channels in reading order, stable within a kind.
 *
 * The direct stream comes first because the panel above it plays exactly that,
 * so the list reads as an explanation of the panel rather than a separate menu.
 */
export function orderRadioChannels(channels: readonly RadioChannel[]): readonly RadioChannel[] {
  return [...channels].sort((left, right) => {
    const leftIndex = KIND_ORDER.indexOf(left.kind);
    const rightIndex = KIND_ORDER.indexOf(right.kind);
    return leftIndex - rightIndex;
  });
}

/** Channels that open something, i.e. the ones that can be a link. */
export function linkableRadioChannels(channels: readonly RadioChannel[]): readonly RadioChannel[] {
  return channels.filter((channel) => channel.url !== undefined && channel.url !== "");
}

/** Milestones oldest first, so the timeline reads forwards. */
export function orderRadioMilestones(
  milestones: readonly RadioMilestone[],
): readonly RadioMilestone[] {
  return [...milestones].sort((left, right) => left.happenedOn.localeCompare(right.happenedOn));
}

/** Countries alphabetically, which is how a reader looks one up. */
export function orderRadioBroadcasts(
  broadcasts: readonly RadioBroadcast[],
): readonly RadioBroadcast[] {
  return [...broadcasts].sort((left, right) => left.country.localeCompare(right.country, "en-GB"));
}

/**
 * The honest one-line summary of coverage.
 *
 * Deliberately not "available in every country": the data lists ten countries
 * with specific methods, and the station's own audience figure covers 130+
 * countries. Those are different claims, and the page states both separately.
 */
export function coverageSummary(broadcasts: readonly RadioBroadcast[]): string {
  const count = broadcasts.length;
  if (count === 0) return "No terrestrial carriage is published.";
  return `Terrestrial or syndicated carriage is published for ${count} ${
    count === 1 ? "country" : "countries"
  }. Everywhere else, listen online.`;
}

/** True when a channel's URL is a page a reader can open, as opposed to the audio stream itself. */
export function isAudioStream(channel: RadioChannel): boolean {
  return channel.kind === "stream";
}

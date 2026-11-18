import type { Partner } from "../schemas";

/**
 * Community partners carried over from the original TMLGuide site.
 *
 * Every name, offer and promotion code below is what the old site actually
 * published, translated into one short English sentence: the partner
 * descriptions came from its translation file and the Rent-a-Tent code
 * ("5% Discount with Code: DCATRAVEL") from the same place. Nothing has been
 * added, no price has been invented, and every record is `confidence:
 * "community"` because none of it comes from the partner's own published terms.
 *
 * The old site described these entries as "verified as trusted service
 * providers" but said nothing about money changing hands. Rather than claim a
 * commission or an endorsement that cannot be verified, each commercial record
 * carries the neutral disclosure below, and the Buy Me a Coffee record states
 * plainly that it is a donation link.
 *
 * `edition` is "all" except for Tomorrowcrazy, whose stated offer is
 * accommodation for Tomorrowland Brasil. Every URL was measured on 2026-11-18
 * and answered 200 (docs/factcheck/links.md).
 */

const CHECKED_ON = "2026-11-18";

const NEUTRAL_DISCLOSURE =
  "Listed as a community partner on the original TMLGuide site; check the partner's own terms before booking.";

type PartnerSeed = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly offer: string;
  readonly disclosure: string;
  readonly edition: "all" | "brasil";
  readonly promoCode?: string;
};

function partner(seed: PartnerSeed): Partner {
  return {
    id: seed.id,
    edition: seed.edition,
    name: seed.name,
    url: seed.url,
    offer: seed.offer,
    disclosure: seed.disclosure,
    ...(seed.promoCode === undefined ? {} : { promoCode: seed.promoCode }),
    lastVerified: CHECKED_ON,
    confidence: "community",
    source: {
      url: seed.url,
      title: seed.name,
      retrievedOn: CHECKED_ON,
    },
  };
}

const seeds: readonly PartnerSeed[] = [
  {
    id: "partner-dca-travel",
    name: "DCA Travel",
    url: "https://dca-travel.com",
    offer: "Travel packages for festivals and events.",
    disclosure: NEUTRAL_DISCLOSURE,
    edition: "all",
  },
  {
    id: "partner-rent-a-tent",
    name: "Rent-a-Tent",
    url: "https://www.rentatentfestival.nl",
    offer: "Festival accommodation rentals. 5% discount with code DCATRAVEL.",
    promoCode: "DCATRAVEL",
    disclosure: NEUTRAL_DISCLOSURE,
    edition: "all",
  },
  {
    id: "partner-beat-retreat",
    name: "Beat Retreat",
    url: "https://www.yourbeatretreat.com/",
    offer: "Festival experience provider.",
    disclosure: NEUTRAL_DISCLOSURE,
    edition: "all",
  },
  {
    id: "partner-eb-travel",
    name: "EB Travel",
    url: "https://eventsbusreizen.nl",
    offer: "Coach and bus transport for festivals and events.",
    disclosure: NEUTRAL_DISCLOSURE,
    edition: "all",
  },
  {
    id: "partner-tomorrowcrazy",
    name: "Tomorrowcrazy",
    url: "https://www.instagram.com/tomorrowcrazys/",
    offer: "Accommodation provider for Tomorrowland Brasil.",
    disclosure: NEUTRAL_DISCLOSURE,
    edition: "brasil",
  },
  {
    id: "partner-buy-me-a-coffee",
    name: "Support Our Community",
    url: "https://buymeacoffee.com/tmlcommunity",
    offer: "Voluntary one-off donation to the community through Buy Me a Coffee.",
    disclosure:
      "A voluntary donation link to the community's Buy Me a Coffee page; it is not a commercial partner and nothing is offered in return.",
    edition: "all",
  },
];

export const partners: readonly Partner[] = seeds.map(partner);

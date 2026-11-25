import type { EditionScope, Resource, ResourceCategory } from "../schemas";

/**
 * Community resources carried over from the original TMLGuide site.
 *
 * Only links measured as ok, or as insecure with an https:// twin that the link
 * check proved live, are published here (docs/factcheck/links.md). The one
 * blocked link in the input, faq.tomorrowland.com, is not here:
 * `resourceSchema` has no `linkStatus` field, so an "unchecked" resource cannot
 * be represented, and a 403 is not evidence that the page works. It is recorded
 * in docs/data/community-omissions.md instead.
 *
 * Where a stored URL only redirected, the record now carries the final address
 * instead of a hop on the way there — three of them as of the 2026-11-25 link
 * run. A URL that answers 200 on the first request is the only kind that can be
 * marked verified on that date, so those three carry `2026-11-25` while the
 * rest keep the date they were actually opened. `index.test.ts` holds the
 * measured from/to pairs and refuses any published URL outside them.
 *
 * The old site grouped links under its own labels (Travel, Festival, Tickets,
 * Guides, Media, Community, Safety). `resourceCategorySchema` has no media or
 * tickets value, so those two groups map to "other" and "practical"
 * respectively, which is also noted as a gap in the omissions document.
 *
 * `confidence` is "official" only where the URL sits on a tomorrowland.com
 * host; everything else is "community". The two festivalviewer.com links are
 * third-party tools and their descriptions say so.
 */

/** The date every record in this file was last opened, unless a seed says otherwise. */
const CHECKED_ON = "2026-11-18";

type ResourceSeed = {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly category: ResourceCategory;
  readonly description: string;
  readonly edition: EditionScope;
  readonly official?: true;
  /**
   * The date this record's URL answered without a redirect, when it is not
   * `CHECKED_ON`. Only set on a record whose URL was re-measured later, so the
   * card never shows today's date against a link nobody opened today.
   */
  readonly verifiedOn?: string;
};

function resource(seed: ResourceSeed): Resource {
  const verifiedOn = seed.verifiedOn ?? CHECKED_ON;
  return {
    id: seed.id,
    edition: seed.edition,
    title: seed.title,
    url: seed.url,
    category: seed.category,
    description: seed.description,
    lastVerified: verifiedOn,
    confidence: seed.official ? "official" : "community",
    source: {
      url: seed.url,
      title: seed.title,
      retrievedOn: verifiedOn,
    },
  };
}

const seeds: readonly ResourceSeed[] = [
  {
    id: "resource-travel-partner",
    title: "Travel Partner (Travel Packages)",
    url: "https://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view",
    category: "practical",
    edition: "all",
    description:
      "Google Drive document that the original guide listed as its travel-partner resource. The document's contents were not re-checked.",
  },
  {
    id: "resource-fraud",
    title: "Fraud Protection (How to Spot a Scammer)",
    url: "https://chat.whatsapp.com/Hp8ob6MM1LI6s2pzgeJPHP",
    category: "community",
    edition: "all",
    description:
      "Community WhatsApp chat about how to spot scammers. The same invite is listed with the groups in this folder.",
  },
  {
    id: "resource-discord",
    title: "Tomorrowland Discord (Official Server - 25K+ Members)",
    url: "https://discord.com/invite/tomorrowland",
    category: "community",
    edition: "all",
    description:
      "Discord invite for Tomorrowland attendees. Neither the 'official server' wording nor the membership figure in this title was verified by the link check, and the server is not run by this guide.",
    verifiedOn: "2026-11-25",
  },
  {
    id: "resource-lineup",
    title: "Line-Up (Official Festival Artists)",
    url: "https://belgium.tomorrowland.com/en/line-up/",
    category: "official",
    edition: "belgium",
    description: "Official Tomorrowland Belgium line-up page, listing the announced artists.",
    official: true,
  },
  {
    id: "resource-prices",
    title: "Ticket Prices (Packages & Categories)",
    url: "https://festivalviewer.com/tomorrowland/tickets",
    category: "practical",
    edition: "all",
    description:
      "Unofficial third-party tool: Ticket prices and package categories for Tomorrowland, published by festivalviewer.com and not by Tomorrowland.",
  },
  {
    id: "resource-maps",
    title: "Tomorrowland Maps (Floorplan/Layout)",
    url: "https://festivalviewer.com/tomorrowland/map/2024",
    category: "practical",
    edition: "belgium",
    description:
      "Unofficial third-party tool: the 2024 Tomorrowland Belgium site map. It is a 2024 layout, so treat it as indicative rather than current.",
  },
  {
    id: "resource-apps",
    title: "Official Apps (Official Tomorrowland Apps)",
    url: "https://tomorrowland.lnk.to/apps",
    category: "official",
    edition: "all",
    description:
      "Short link (tomorrowland.lnk.to) that gathers the official Tomorrowland apps in one place instead of a tomorrowland.com page.",
  },
  {
    id: "resource-radio",
    title: "One World Radio (Live Stream)",
    url: "https://www.tomorrowland.com/one-world-radio/",
    category: "official",
    edition: "all",
    description: "Official live stream page for One World Radio, Tomorrowland's radio station.",
    official: true,
    verifiedOn: "2026-11-25",
  },
  {
    id: "resource-official",
    title: "Tomorrowland (Official Website)",
    url: "https://www.tomorrowland.com/",
    category: "official",
    edition: "all",
    description: "The official Tomorrowland website.",
    official: true,
    verifiedOn: "2026-11-25",
  },
  {
    id: "resource-packing",
    title: "Festival Packing List",
    url: "https://drive.google.com/file/d/14HcfxSkxX2y-gZFSYshYH80zBvQuVr03/view?usp=drive_link",
    category: "practical",
    edition: "all",
    description: "Packing list for a festival weekend, kept as a Google Drive document.",
  },
  {
    id: "resource-whatsapp",
    title: "WhatsApp Community",
    url: "https://chat.whatsapp.com/Jt8m3LkfniYC7Vipnavj2e",
    category: "community",
    edition: "all",
    description:
      "Entry point to the community WhatsApp chats. This is the same invite as the solo and group travellers chat listed with the groups.",
  },
  {
    id: "resource-fb-solo",
    title: "Facebook Community (Solo & Group Travellers)",
    url: "https://www.facebook.com/groups/2139484856326667",
    category: "community",
    edition: "all",
    description: "Facebook group for solo travellers and small groups going to Tomorrowland.",
  },
  {
    id: "resource-soundcloud",
    title: "Soundcloud Playlist",
    url: "https://soundcloud.com/pepe0711/sets/tomorrowland-down-memory-lane/s-JEcX8Htu08z",
    category: "other",
    edition: "all",
    description: "SoundCloud playlist of Tomorrowland sets, kept on a community account.",
  },
  {
    id: "resource-fb-sa",
    title: "Facebook Community (South Africa)",
    url: "https://www.facebook.com/groups/1754757464796152",
    category: "community",
    edition: "all",
    description: "Facebook group for the South African Tomorrowland community.",
  },
  {
    id: "resource-fb-malta",
    title: "Facebook Community (Malta)",
    url: "https://www.facebook.com/groups/931818451869878",
    category: "community",
    edition: "all",
    description: "Facebook group for the Maltese Tomorrowland community.",
  },
  {
    id: "resource-ticketswap",
    title: "TicketSwap (Add-on Voucher Sale)",
    url: "https://www.ticketswap.com/location/tomorrowland-belgium/240981",
    category: "practical",
    edition: "belgium",
    description:
      "Third-party resale marketplace listing Tomorrowland Belgium tickets and add-ons. It is not run by Tomorrowland and listings are not checked by this guide.",
  },
  {
    id: "resource-tml-spotify",
    title: "Tomorrowland Spotify Playlist",
    url: "https://open.spotify.com/playlist/7459neGrcVmDCkEJqaOuEn?si=BNtl44mBSRm47MHiSGCZ-A&pi=8OQSWd8UR1q-q",
    category: "other",
    edition: "all",
    description: "Spotify playlist of Tomorrowland tracks.",
  },
  {
    id: "resource-hardstyle-classics",
    title: "Hardstyle Classics Spotify Playlist",
    url: "https://open.spotify.com/playlist/3ykFIRXVp1C67JnR79pSf7?si=kMZUPlE1ROCaylaEwdW03Q&pi=iQ_-hTo5QFKm0",
    category: "other",
    edition: "all",
    description: "Spotify playlist of hardstyle classics.",
  },
  {
    id: "resource-bracelet-tracking",
    title: "Bracelet Tracking (BPost)",
    url: "https://track.bpost.cloud/btr/web/#/home",
    category: "practical",
    edition: "belgium",
    description: "bpost tracking entry point for bracelet deliveries.",
  },
];

export const resources: readonly Resource[] = seeds.map(resource);

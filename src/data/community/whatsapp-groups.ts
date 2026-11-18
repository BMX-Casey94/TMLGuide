import type { EditionScope, WhatsappGroup } from "../schemas";

/**
 * Community WhatsApp groups carried over from the original TMLGuide site.
 *
 * Every invite below was opened on 2026-11-18 and answered with the name of a
 * live group (docs/factcheck/links.md), so each one is published with
 * `linkStatus: "ok"` and that check date. Groups whose old invite used plain
 * http:// are stored with the https:// twin the link check proved live, because
 * the schema refuses anything but an absolute https URL.
 *
 * Titles are reproduced verbatim from the old data, emoji included. The name a
 * group shows on its invite page is not stored: the group schema has no field
 * for it, and the measured status already lives in `linkStatus`.
 *
 * Two groups from the old list are deliberately absent, and both are recorded
 * with their reason in docs/data/community-omissions.md:
 * - wa-24 ("Festival Outfits"): the invite is revoked, so there is no group.
 * - wa-4 ("Weekend 2 (General Chat)"): the invite answers, but its page now
 *   reads "W2 chat closed", so publishing it as an active group would mislead.
 *
 * `region` and `edition` are not in the old data. `region` comes from the group
 * title where the title names a place, and is "Worldwide" for the chats that
 * name none. `edition` is "belgium" for Belgium-weekend, DreamVille, camping,
 * transport and exchange chats, "winter" and "brasil" for those two editions,
 * and "all" for the city meet-ups that belong to neither Belgian weekend.
 */

const CHECKED_ON = "2026-11-18";

type GroupSeed = {
  readonly id: string;
  readonly title: string;
  readonly region: string;
  readonly edition: EditionScope;
  readonly inviteUrl: string;
};

function group(seed: GroupSeed): WhatsappGroup {
  return {
    id: seed.id,
    edition: seed.edition,
    title: seed.title,
    region: seed.region,
    inviteUrl: seed.inviteUrl,
    linkStatus: "ok",
    lastLinkCheck: CHECKED_ON,
    lastVerified: CHECKED_ON,
    confidence: "community",
    source: {
      url: seed.inviteUrl,
      title: seed.title,
      retrievedOn: CHECKED_ON,
    },
  };
}

const seeds: readonly GroupSeed[] = [
  {
    id: "wa-1",
    title: "Solo & Group Travellers (Community) ✨✈️",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/Jt8m3LkfniYC7Vipnavj2e",
  },
  {
    id: "wa-2",
    title: "Main Chat (Solo & Group Travellers) 💬",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/LyRDb3qxs0u1eytQKsCmDw",
  },
  {
    id: "wa-3",
    title: "Weekend 1 (General Chat) 💬",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/GfB6z4RDvQN65mGpSYFXu5",
  },
  {
    id: "wa-5",
    title: "South Africa Chat (🇿🇦) ☁️",
    region: "South Africa",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/HPbZsTu80o532IMrpwS0px",
  },
  {
    id: "wa-6",
    title: "DreamVille (MG) - W1 Group Camp ⛺️",
    region: "DreamVille, Boom, Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/FtDY6xKSibc3je5dUa98IS",
  },
  {
    id: "wa-7",
    title: "DreamVille (MG) - W2 Group Camp ⛺️",
    region: "DreamVille, Boom, Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/LD1AyBrArih1pab5xfMNA9",
  },
  {
    id: "wa-8",
    title: "DreamVille (Easy Tent) - W1 Group Camp ⛺️",
    region: "DreamVille, Boom, Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/HQbdftFnYGPGvnn068L6bp",
  },
  {
    id: "wa-9",
    title: "DreamVille (Easy Tent) - W2 Group Camp ⛺️",
    region: "DreamVille, Boom, Belgium",
    edition: "belgium",
    // Old invite was http://; this is its https:// twin, measured live.
    inviteUrl: "https://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7",
  },
  {
    id: "wa-10",
    title: "Accommodation (Camping, Airbnb, B&B, Hotels) ⛺️🏝️🏨",
    region: "Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B",
  },
  {
    id: "wa-11",
    title: "Transport & Travel (Local Taxis, Buses) 🚖🚌",
    region: "Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ",
  },
  {
    id: "wa-12",
    title: "NFT (Information & Exchange) 🥉",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY",
  },
  {
    id: "wa-13",
    title: "Add-on Voucher Sales (Exchange & Swap) 🍽️🥂",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/Bu4EGrMSLy17tbQ3v698VH",
  },
  {
    id: "wa-14",
    title: "Tickets (Exchange/Swap/Advice) 🎟️📷",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/DPFTB5gRUTLHv0yPZyYVF6",
  },
  {
    id: "wa-15",
    title: "Fraud Protection (How to spot Scammers) ❗️❓",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/Hp8ob6MM1LI6s2pzgeJPHP",
  },
  {
    id: "wa-16",
    title: "Merchandise/Second Hand (Exchange & Swap) 🛒",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/FVf9DQZnv8y5h1jA1egMpW",
  },
  {
    id: "wa-17",
    title: "First Timer FAQs ℹ️",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/LVHVVY3ayLVAPt97CsXz69",
  },
  {
    id: "wa-18",
    title: "Camping Equipment Rental ⛺️🌲",
    region: "Belgium",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/H1iVWLwyotp1GYERjbRqIl",
  },
  {
    id: "wa-19",
    title: "Core (Medellin, COL) 🇨🇴",
    region: "Medellín, Colombia",
    edition: "all",
    inviteUrl: "https://chat.whatsapp.com/K5u56TF16ZAKTSHZnMhHf8",
  },
  {
    id: "wa-20",
    title: "Brazil (São Paulo) 🇧🇷",
    region: "São Paulo, Brazil",
    edition: "brasil",
    inviteUrl: "https://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm",
  },
  {
    id: "wa-21",
    title: "Winter (Alp d'Huez, FR) 🇫🇷",
    region: "Alpe d'Huez, France",
    edition: "winter",
    inviteUrl: "https://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq",
  },
  {
    id: "wa-22",
    title: "Terra Solis (Dubai) 🇦🇪",
    region: "Dubai, UAE",
    edition: "all",
    inviteUrl: "https://chat.whatsapp.com/EpzYXADRagC7x0EG58MfbE",
  },
  {
    id: "wa-23",
    title: "TML X INSOMNIAC - UNITY (LA, Sphere) 🇺🇸",
    region: "Los Angeles, USA",
    edition: "all",
    inviteUrl: "https://chat.whatsapp.com/CeI63us7R6z8xVsGB8tDD8",
  },
  {
    id: "wa-25",
    title: "Female Only (General Chat) 💬👸",
    region: "Worldwide",
    edition: "belgium",
    inviteUrl: "https://chat.whatsapp.com/EDB3Pf2urIC0HFu3aPg8tt",
  },
  {
    id: "wa-26",
    title: "ADE (Amsterdam, NL) 🇳🇱",
    region: "Amsterdam, Netherlands",
    edition: "all",
    inviteUrl: "https://chat.whatsapp.com/KykJ2awuelP1JL1ovoSjhg",
  },
];

export const whatsappGroups: readonly WhatsappGroup[] = seeds.map(group);

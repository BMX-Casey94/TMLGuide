import type { GuideChapter } from "../schema";

/**
 * Belgium chapter 4 of 5 (part A).
 *
 * The five DreamVille areas are the ones the official Discover DreamVille page
 * names and the ledger confirms. Package totals come from the accommodation
 * collection; no total is typed here. The pass-plus-element arithmetic is the
 * ledger's own note and is stated as the way the price is built, not as a
 * separate quote.
 */
export const accommodationChapter = {
  edition: "belgium",
  slug: "accommodation",
  order: 4,
  title: "Accommodation",
  summary:
    "The five DreamVille areas and how they differ, which options sit outside DreamVille, and how a package total is built from a festival pass plus an accommodation element.",
  lastVerified: "2026-11-18",
  related: [
    "belgium/dreamville",
    "belgium/tickets",
    "belgium/global-journey",
    "belgium/add-ons",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — discover DreamVille",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — accommodation",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — Magnificent Greens 1P packages, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/magnificent-greens/magnificent-greens-1p-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — Magnificent Greens area",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/magnificent-greens-area/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — Camp2Camp, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/camp2camp/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — Easy Tent 2P packages, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/easy-tent/easy-tent-packages/easy-tent-2p-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — Friendship Garden 10P packages, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/friendship-garden/friendship-garden-10p-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — Montagoe accommodation index, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/montagoe/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "Tomorrowland Belgium — Montagoe area",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/montagoe-area/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "Tomorrowland Belgium — Global Journey",
      url: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s12",
      title: "Tomorrowland — hospitality packages",
      url: "https://belgium.tomorrowland.com/hospitality/welcome/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s13",
      title: "Tomorrowland — Mansions",
      url: "https://belgium.tomorrowland.com/hospitality/mansions/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s14",
      title: "Can I buy a tent at DreamVille",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037810891-Can-I-buy-a-tent-at-DreamVille",
      checkedOn: "2026-11-18",
    },
    {
      id: "s15",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "where-you-can-sleep", text: "Where you can sleep" },
    {
      type: "p",
      text: "DreamVille has five accommodation areas: Magnificent Greens, Camp2Camp, Easy Tent, Friendship Garden and Montagoe. Each is a different product with its own price, and every one of them is sold as a package that bundles a Full Madness pass with a place to sleep.",
      sources: ["s1", "s2"],
    },
    {
      type: "facts",
      caption: "The five DreamVille areas",
      rows: [
        {
          label: "Magnificent Greens",
          value: "Pitch-your-own camping. Bring your own tent, or buy a 1P or 2P tent package that includes a pop-up tent and bedding.",
          sources: ["s3", "s4"],
        },
        {
          label: "Camp2Camp",
          value: "Pre-pitched tent for two people, with a double air mattress, two sleeping bags and two relax chairs.",
          sources: ["s5"],
        },
        {
          label: "Easy Tent",
          value: "Pre-erected tent for two or four people, with bedding, a night light, a mirror and a lock. Two 4P tents are joined by a walkway.",
          sources: ["s6"],
        },
        {
          label: "Friendship Garden",
          value: "Private group plot for ten people, with a Tomorrowland shelter and ten Full Madness passes.",
          sources: ["s7"],
        },
        {
          label: "Montagoe",
          value: "The lodge area: eleven unit types, all for two people, with a restaurant, bar, swimming pool and a lobby crew on duty around the clock.",
          sources: ["s8", "s9"],
        },
      ],
    },
    { type: "h2", id: "how-packages-are-priced", text: "How a package is priced" },
    {
      type: "p",
      text: "A DreamVille package is a festival pass plus an accommodation element. The pass inside a package is priced below the standalone Full Madness pass, and the rest of the total is the area or unit element. A two-person package therefore reads as two passes plus one accommodation element, not as two separate bookings.",
      sources: ["s3", "s10"],
    },
    {
      type: "p",
      text: "That is why a package total moves between the two sales: the pass element rises with the sale while several unit elements stay fixed. Every package below is shown at the 2027 price the official page publishes, per stay rather than per night.",
      sources: ["s2", "s10"],
    },
    {
      type: "callout",
      tone: "note",
      title: "A package is one purchase, not two",
      text: "Buying a DreamVille package does not leave you holding a spare festival ticket, and buying a festival pass separately does not give you DreamVille access. The two are different products that happen to contain the same pass.",
      sources: ["s2", "s10"],
    },
    { type: "h2", id: "magnificent-greens", text: "Magnificent Greens" },
    {
      type: "p",
      text: "Magnificent Greens is the pitch-your-own area. The entry-level product is a one-person package: a pitch for your own tent plus the Full Madness pass. The tent packages replace the pitch with a branded pop-up tent and bedding, which is where the price step between the two comes from.",
      sources: ["s3", "s4"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-magnificent-greens",
      caption: "Magnificent Greens pitch and tent packages, 2027",
    },
    {
      type: "p",
      text: "The area page also confirms that sinks, toilets and open-air showers are available at any time and free of charge.",
      sources: ["s4"],
    },
    { type: "h2", id: "camp2camp", text: "Camp2Camp" },
    {
      type: "p",
      text: "Camp2Camp is the pre-pitched rental: a tent already standing when you arrive, with a double air mattress, two sleeping bags and two relax chairs for two people. It is the product to pick if you want the tent handled but do not need the Easy Tent extras.",
      sources: ["s5"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-camp2camp",
      caption: "Camp2Camp pre-pitched 2P, 2027",
    },
    { type: "h2", id: "easy-tent", text: "Easy Tent" },
    {
      type: "p",
      text: "Easy Tent is a pre-erected tent with bedding included, sold for two or four people. The 4P product is two tents joined by a walkway, with one lock for the pair rather than one each.",
      sources: ["s6"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-easy-tent",
      caption: "Easy Tent 2P and 4P, 2027",
    },
    {
      type: "p",
      text: "Spectacular and Supreme Easy Tent variants appear on the official pages, but no 2027 price is published for either, so neither is shown here as a price.",
      sources: ["s2"],
    },
    { type: "h2", id: "friendship-garden", text: "Friendship Garden" },
    {
      type: "p",
      text: "Friendship Garden is a private plot for ten people with a shelter and ten Full Madness passes, sold in the WorldWide Ticket Sale only. It is also the named exception to the four-person cap per account, so the ten-person product does not conflict with that limit.",
      sources: ["s7", "s15"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-friendship-garden",
      caption: "Friendship Garden 10P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-spectacular-friendship-garden",
      caption: "Spectacular Friendship Garden 10P, 2027",
    },
    {
      type: "callout",
      tone: "warning",
      title: "One plot, one purchase",
      text: "Friendship Garden has no pre-sale record, because it is sold in the WorldWide Ticket Sale only. A group planning around it has a single date to work with, and no earlier attempt to fall back on.",
      sources: ["s7"],
    },
    { type: "h2", id: "montagoe", text: "Montagoe" },
    {
      type: "p",
      text: "Montagoe is the lodge area, and everything in it is sold for two people. The units range from a lockable room with beds and a clothing rack to a lodge with a living area, a couch and extra storage. All Montagoe guests share the area's restaurant, bar, swimming pool, towel service and lobby crew, and its sanitary facilities are free and open at all times.",
      sources: ["s8", "s9"],
    },
    {
      type: "p",
      text: "Eleven units make up the 2027 line-up: Relax Room, DreamLodge, Spectacular DreamLodge, Kokono, Luna, Cabana, Astera, Marivela, Ensuite, and the two new units Solara and Noctis. Each official page lists its own inclusions, which is where to check before choosing between two units at a similar price.",
      sources: ["s8"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-relax-room",
      caption: "Relax Room 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-dreamlodge",
      caption: "DreamLodge 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-kokono",
      caption: "Kokono 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-cabana",
      caption: "Cabana 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-noctis",
      caption: "Noctis 2P, one of the two units new for 2027",
    },
    {
      type: "p",
      text: "The rest of the line-up is published the same way. Luna is a 500 × 500 cm unit with two relax chairs and a private locker at the lobby; Astera is a lockable 370 × 260 cm unit whose official inclusion list carries no locker; Spectacular DreamLodge is a 517 × 220 cm lodge with a living area, bathrobes, slippers and bath products.",
      sources: ["s8"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-luna",
      caption: "Luna 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-astera",
      caption: "Astera 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-spectacular-dreamlodge",
      caption: "Spectacular DreamLodge 2P, 2027",
    },
    {
      type: "p",
      text: "The units with a private bathroom are Marivela, Ensuite and the new Solara. Marivela and Ensuite also have air conditioning and a made-up double bed; Solara is 360 × 320 cm.",
      sources: ["s8"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-marivela",
      caption: "Marivela 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-ensuite",
      caption: "Ensuite 2P, 2027",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "accommodation",
      idPrefix: "belgium-2027-solara",
      caption: "Solara 2P, one of the two units new for 2027",
    },
    {
      type: "p",
      text: "Every Montagoe page lists a parking voucher among the inclusions and adds the same qualification: parking is not included when the unit is bought through a Global Journey package. Parking is otherwise part of the price.",
      sources: ["s8", "s11"],
    },
    { type: "h2", id: "outside-dreamville", text: "Outside DreamVille" },
    {
      type: "p",
      text: "Not every bed sold with a Tomorrowland ticket is in DreamVille. A Global Journey package can be built around a hotel rather than a tent, and the official package page states that a daily transfer to the festival is included. That is the structural difference from a DreamVille package, which puts you on site.",
      sources: ["s11"],
    },
    {
      type: "p",
      text: "The Mansion is a separate hospitality product with five bedrooms and a private lounge. It is quote-only, no price is published, and festival access is not included, so it is not an accommodation package in the sense the rest of this page uses.",
      sources: ["s13"],
    },
    {
      type: "p",
      text: "Hospitality packages are sold to companies only, with a minimum of ten guests, and they carry no DreamVille access at all.",
      sources: ["s12"],
    },
    {
      type: "p",
      text: "Renting gear is possible without buying a tent package: DreamVille camping gear, including tents, is rented through the Add-On Sale. The 2027 prices for that gear are not published.",
      sources: ["s14"],
    },
  ],
} satisfies GuideChapter;

import type { SourceEntry } from "./types";

/**
 * The site's own destinations, one entry per known route.
 *
 * These are the pages a reader can actually open today, so every one of them is
 * indexed: a palette that omits `/about` or `/tools/budget` makes the site feel
 * smaller than it is. Descriptions mirror each page's own metadata rather than
 * describing a plan, and carry no fact the page does not state.
 *
 * `lastVerified` is deliberately absent. A page is not a checked fact: it is a
 * view over facts that each carry their own date, and stamping today's date on
 * the page would imply a check that did not happen.
 */
export const pageEntries: SourceEntry[] = [
  {
    slug: "home",
    title: "Home",
    snippet:
      "The independent guide to Tomorrowland: tickets, sale dates, DreamVille, travel and budgeting for Belgium, Winter and Brasil.",
    edition: "all",
    href: "/",
    source: "src/app/page.tsx",
  },
  {
    slug: "guides",
    title: "Guides",
    snippet:
      "The guide index: tickets and packages, sale dates and the planning pages, each built from sourced figures.",
    edition: "all",
    href: "/guides",
    source: "src/app/guides/page.tsx",
  },
  {
    slug: "tickets",
    title: "Tickets and packages",
    snippet:
      "Every ticket, DreamVille package and travel package the official site prices for the 2027 editions, with the sale calendar and what each product includes.",
    edition: "all",
    href: "/guides/tickets",
    source: "src/app/guides/tickets/page.tsx",
  },
  {
    slug: "tools",
    title: "Tools",
    snippet:
      "Independent planning tools: a festival budget calculator, a Pearl converter and a ticket sale timeline with calendar export.",
    edition: "all",
    href: "/tools",
    source: "src/app/tools/page.tsx",
  },
  {
    slug: "budget",
    title: "Festival budget calculator",
    snippet:
      "Add tickets, accommodation, travel, food and extras for one person or a group, in euros or reais, with a category breakdown.",
    edition: "all",
    href: "/tools/budget",
    source: "src/app/tools/budget/page.tsx",
  },
  {
    slug: "pearls",
    title: "Pearl calculator",
    snippet:
      "Convert between euros and Tomorrowland Pearls at a rate you supply. The 2027 Pearl rate is not published, so the tool asks for it rather than assuming one.",
    edition: "all",
    href: "/tools/pearls",
    source: "src/app/tools/pearls/page.tsx",
  },
  {
    slug: "sale-timeline",
    title: "Ticket sale timeline",
    snippet:
      "Every published Tomorrowland ticket sale for Belgium, Winter and Brasil, with a live countdown, times in your own zone and Brussels time, and a calendar export.",
    edition: "all",
    href: "/tools/sale-timeline",
    source: "src/app/tools/sale-timeline/page.tsx",
  },
  {
    slug: "journey",
    title: "Journey planner",
    snippet:
      "Plan how to reach Tomorrowland Belgium or Winter from published shuttle, rail and parking facts, with unpublished 2027 fares flagged plainly.",
    edition: "all",
    href: "/tools/journey",
    source: "src/app/tools/journey/page.tsx",
  },
  {
    slug: "packing",
    title: "Packing list",
    snippet:
      "An edition-by-edition checklist separating official Tomorrowland rules from ordinary travel suggestions, saved in this browser and ready to print.",
    edition: "all",
    href: "/tools/packing",
    source: "src/app/tools/packing/page.tsx",
  },
  {
    slug: "my-trip",
    title: "My Trip",
    snippet:
      "Keep your weekend, ticket, accommodation, travel notes and upcoming sale dates in one private sheet stored only in this browser.",
    edition: "all",
    href: "/tools/my-trip",
    source: "src/app/tools/my-trip/page.tsx",
  },
  {
    slug: "maps",
    title: "Venue & DreamVille maps",
    snippet:
      "An interactive OpenStreetMap view of De Schorre and DreamVille with this guide's own zone outlines, plus a point-to-point walking planner in minutes and miles and peak crowd-surge notes.",
    edition: "belgium",
    href: "/tools/maps",
    source: "src/app/tools/maps/page.tsx",
  },
  {
    slug: "winter-timer",
    title: "Winter stage-hopping & lift timer",
    snippet:
      "Estimate transit times between Alpe d'Huez mountain stages, village stages and resort hubs, broken down into walk or ski, lift ride and queue buffer.",
    edition: "winter",
    href: "/tools/winter-timer",
    source: "src/app/tools/winter-timer/page.tsx",
  },
  {
    slug: "ask",
    title: "Ask the guide",
    snippet:
      "Ask a question about Tomorrowland Belgium, Winter or Brasil and get an answer drawn only from this guide's verified, dated records, with the official source beside it.",
    edition: "all",
    href: "/ask",
    source: "src/app/ask/page.tsx",
  },
  {
    slug: "community",
    title: "Community",
    snippet:
      "Attendee-run WhatsApp groups, third-party resources and partner offers, with every link checked and every partner disclosure printed in full.",
    edition: "all",
    href: "/community",
    source: "src/app/community/page.tsx",
  },
  {
    slug: "radio",
    title: "One World Radio",
    snippet:
      "How to listen to One World Radio, Tomorrowland's own station: the official stream, the apps that carry it, and which countries have DAB+, FM or syndicated coverage.",
    edition: "all",
    href: "/radio",
    source: "src/app/radio/page.tsx",
  },
  {
    slug: "about",
    title: "About this guide",
    snippet:
      "Who runs TMLGuide, how each fact is checked against Tomorrowland's own pages, how errors are corrected, and the official sites every figure comes from.",
    edition: "all",
    href: "/about",
    source: "src/app/about/page.tsx",
  },
  {
    slug: "accessibility",
    title: "Accessibility statement",
    snippet:
      "How TMLGuide approaches WCAG 2.2 AA, what has been tested automatically, what has not yet been tested by hand, and how to use the display toolbar.",
    edition: "all",
    href: "/accessibility",
    source: "src/app/accessibility/page.tsx",
  },
  {
    slug: "more",
    title: "More",
    snippet:
      "The pages outside the main tabs: Ask the guide, One World Radio, About this guide and the accessibility statement.",
    edition: "all",
    href: "/more",
    source: "src/app/more/page.tsx",
  },
];

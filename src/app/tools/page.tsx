import type { Metadata } from "next";
import { ToolCard, type ToolCardStatus } from "@/components/tools/tool-card";
import type { Icon3DName } from "@/components/ui/icon-3d";
import "@/components/tools/tools.css";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Independent planning tools for Tomorrowland: budget and Pearl calculators, sale timeline with calendar export, journey planner, packing list and My Trip sheet. Every figure is sourced and dated.",
  alternates: { canonical: "/tools" },
};

interface ToolEntry {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: Icon3DName;
  readonly kicker: string;
  readonly status: ToolCardStatus;
}

/**
 * The tools in the hub.
 *
 * Only tools that exist are listed as live. Anything planned stays out of the
 * list rather than appearing as a dead card: a link that cannot be followed is a
 * worse promise than an honest short list.
 */
const TOOLS: readonly ToolEntry[] = [
  {
    href: "/tools/budget",
    kicker: "Money",
    title: "Festival budget calculator",
    description:
      "Add up tickets, accommodation, travel, food and extras for one person or a group, with a per-category breakdown in euros or reais.",
    icon: "wallet",
    status: "live",
  },
  {
    href: "/tools/pearls",
    kicker: "Cashless",
    title: "Pearl calculator",
    description:
      "Convert between money and Pearls at a rate you supply, because the 2027 rate has not been announced yet.",
    icon: "money-bag",
    status: "live",
  },
  {
    href: "/tools/sale-timeline",
    kicker: "Dates",
    title: "Ticket sale timeline",
    description:
      "See every published sale for Belgium, Winter and Brasil, with a live countdown and calendar export.",
    icon: "target",
    status: "live",
  },
  {
    href: "/tools/journey",
    kicker: "Travel",
    title: "Journey planner",
    description:
      "Work out how to get to Belgium or Winter from published shuttle, rail and parking facts, with missing 2027 fares flagged plainly.",
    icon: "map-pin",
    status: "live",
  },
  {
    href: "/tools/packing",
    kicker: "Checklist",
    title: "Packing list",
    description:
      "An edition-by-edition checklist separating official rules and products from ordinary travel suggestions, saved in your browser and ready to print.",
    icon: "bag",
    status: "live",
  },
  {
    href: "/tools/my-trip",
    kicker: "Planner",
    title: "My Trip",
    description:
      "Keep your chosen weekend, ticket, accommodation, travel notes and upcoming sale dates in one private sheet stored only in this browser.",
    icon: "notebook",
    status: "live",
  },
];

/**
 * The tools hub.
 *
 * A Server Component: the page is a static list of cards, so it prerenders and
 * costs the browser no JavaScript.
 */
export default function ToolsPage() {
  return (
    <main id="main" className="tool-page">
      <div className="tool-page__inner">
        <header className="tool-head">
          <p className="label text-accent">Independent guide</p>
          <h1 className="tool-head__title">Tools</h1>
          <div className="tool-head__intro">
            <p>
              Calculators for the money side of a Tomorrowland trip. Each one works from published
              prices, says where every figure came from, and tells you when it does not know
              something rather than guessing.
            </p>
            <p>
              Nothing here is an official Tomorrowland calculator, and no tool converts between
              currencies: euros stay euros and reais stay reais.
            </p>
          </div>
        </header>

        <noscript>
          <div className="tool-noscript">
            <p className="label">JavaScript is off</p>
            <p>
              The cards below still work: each tool is a page you can open and read. The
              calculators themselves need JavaScript to update a figure as you type, so they show
              their prices and sources without doing the arithmetic.
            </p>
          </div>
        </noscript>

        <section aria-labelledby="tools-live" className="mt-14">
          <h2 id="tools-live" className="tool-panel__title">
            Planning tools
          </h2>
          <div className="tool-hub-grid">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.href}
                href={tool.href}
                kicker={tool.kicker}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                status={tool.status}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="tools-notes" className="mt-16">
          <h2 id="tools-notes" className="tool-panel__title">
            What these tools will not do
          </h2>
          <ul className="tool-sources" role="list">
            <li>
              They do not convert currencies. A Brasil budget is in reais; a Belgium or Winter budget
              is in euros.
            </li>
            <li>
              They do not fill a gap in the data. A price the organisers have not published is shown
              as unpublished, never estimated.
            </li>
            <li>
              They do not replace the official site for anything that involves paying money or
              giving personal details.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

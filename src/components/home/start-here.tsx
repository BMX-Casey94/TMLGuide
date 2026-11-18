import { CardCarousel } from "@/components/ui/card-carousel";
import { Card } from "@/components/ui/card";
import { SectionAction, SectionHeading } from "@/components/ui/section-heading";
import type { Icon3DName } from "@/components/ui/icon-3d";

/** One entry in the "start here" row. */
export interface StartHereItem {
  readonly href: string;
  readonly title: string;
  readonly kicker: string;
  readonly icon: Icon3DName;
  readonly body: string;
}

/**
 * The six places to begin, in the order a first-time planner needs them: what
 * it costs to get in, when you can buy, what the trip adds up to, what the site
 * uses instead of money, who else is going, and what to listen to meanwhile.
 *
 * Every icon name is one of the names exported by `icon-3d`, whose own test
 * checks the list against the files on disk, so a renamed icon fails the suite
 * rather than a page.
 */
export const START_HERE: readonly StartHereItem[] = [
  {
    href: "/guides/tickets",
    title: "Tickets and packages",
    kicker: "Plan",
    icon: "gift",
    body: "Pass types, DreamVille packages and add-ons, each with the 2027 price it was published at and the source it came from.",
  },
  {
    href: "/tools/sale-timeline",
    title: "Sale timeline",
    kicker: "Dates",
    icon: "chart",
    body: "Every sale moment on one timeline, shown in the zone it was published in and in UK time, with the date it was last checked.",
  },
  {
    href: "/tools/budget-calculator",
    title: "Budget calculator",
    kicker: "Costs",
    icon: "wallet",
    body: "Ticket, travel, DreamVille and spending money in one total, so the whole trip is a number before you commit to it.",
  },
  {
    href: "/tools/pearl-calculator",
    title: "Pearl calculator",
    kicker: "On site",
    icon: "money-bag",
    body: "Food and drinks are paid in Pearls, loaded onto your bracelet. Work out how many you need before you top up.",
  },
  {
    href: "/community",
    title: "Community groups",
    kicker: "People",
    icon: "thumb-up",
    body: "Group chats by weekend, transport, accommodation and edition, plus the community partners already listed on this site.",
  },
  {
    href: "/radio",
    title: "One World Radio",
    kicker: "Listen",
    icon: "headphone",
    body: "The festival's own station, played here through its public stream. Nothing loads until you press play.",
  },
];

/**
 * The six entry points, each a whole-card link with its 3D icon. A carousel on
 * phones and a grid from 700px, so six cards do not become a column of six.
 */
export function StartHere() {
  return (
    <section className="home-section" aria-labelledby="start-here-heading">
      <SectionHeading
        id="start-here-heading"
        kicker="Start here"
        title="Six ways into the guide"
        lede="Four of these do the planning: what a ticket costs, when it goes on sale, what the trip adds up to, and what you will need on site."
        action={<SectionAction href="/guides">All guides</SectionAction>}
      />

      <CardCarousel label="Ways to start planning" className="home-start mt-8">
        {START_HERE.map((item) => (
          <Card
            key={item.href}
            kicker={item.kicker}
            title={item.title}
            icon={item.icon}
            href={item.href}
          >
            {item.body}
          </Card>
        ))}
      </CardCarousel>
    </section>
  );
}

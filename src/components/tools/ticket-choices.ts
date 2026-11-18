import type { ToolEdition } from "./editions";

/**
 * The ticket products a budget can start from.
 *
 * Every option is read straight from the validated data layer for its edition,
 * so a price shown in the calculator is the same published price the edition
 * pages show, with the same source and check date. Nothing is typed in here, and
 * no option exists that the data does not hold.
 *
 * Two conventions carried over from the data:
 *
 * - Money is stored in minor units (euro cents, or centavos) because the budget
 *   arithmetic is integer arithmetic. Brasil prices are whole reais in the data,
 *   so they are multiplied by 100 and never converted to euros.
 * - A Brasil ticket record carries an `availability` of "sold-out", which is
 *   surfaced on the option so a "sold out" price is never mistaken for a
 *   buyable one.
 */
import { brasilTickets } from "@/data/brasil";
import { tickets as belgiumTickets } from "@/data/belgium";
import { winterTickets } from "@/data/winter";

/** One selectable ticket product. */
export interface TicketChoice {
  readonly id: string;
  /** The product's published name, used verbatim. */
  readonly label: string;
  /** Price for one person, in minor units of the edition's currency. */
  readonly priceMinor: number;
  /** Extra line shown under the option, for example a sale tier or sold-out state. */
  readonly detail: string;
  /** True when the data marks the product as sold out. */
  readonly soldOut: boolean;
  /** The official page the price was read from. */
  readonly sourceUrl: string;
  /** The date that page was read, in YYYY-MM-DD form. */
  readonly lastVerified: string;
}

/** The sentinel id for a hand-typed ticket price. */
export const CUSTOM_TICKET_ID = "custom";

function euroMinor(priceEur: number): number {
  // The schema guarantees at most two decimals, so this is exact.
  return Math.round(priceEur * 100);
}

/**
 * Belgium: one record per sale tier, so the label already says which sale the
 * price belongs to. Standalone passes only; a DreamVille package price includes
 * the pass and is offered through the accommodation field instead.
 */
function belgiumChoices(): readonly TicketChoice[] {
  return belgiumTickets.map((ticket) => ({
    id: ticket.id,
    label: ticket.name,
    priceMinor: euroMinor(ticket.priceEur),
    detail: ticket.includes.join("; "),
    soldOut: false,
    sourceUrl: ticket.source.url,
    lastVerified: ticket.lastVerified,
  }));
}

/**
 * Winter: exactly one published price, the 7-Day Festival Ticket. The 4-day and
 * 1-day products exist but publish no price, so they are absent rather than
 * guessed, and the calculator simply offers the one real figure.
 */
function winterChoices(): readonly TicketChoice[] {
  return winterTickets.map((ticket) => ({
    id: ticket.id,
    label: ticket.name,
    priceMinor: euroMinor(ticket.priceEur),
    detail: ticket.includes.join("; "),
    soldOut: false,
    sourceUrl: ticket.source.url,
    lastVerified: ticket.lastVerified,
  }));
}

/**
 * Brasil: prices are whole reais, so the minor-unit figure is the published
 * amount times one hundred. Every 2027 Brasil product is currently sold out,
 * which the detail line states.
 */
function brasilChoices(): readonly TicketChoice[] {
  return brasilTickets.map((ticket) => {
    const soldOut = ticket.availability === "sold-out";
    return {
      id: ticket.id,
      label: ticket.name,
      priceMinor: ticket.price.amount * 100,
      detail: soldOut ? `${ticket.notes} Currently sold out.` : ticket.notes,
      soldOut,
      sourceUrl: ticket.source.url,
      lastVerified: ticket.lastVerified,
    };
  });
}

const CHOICES: Readonly<Record<ToolEdition, readonly TicketChoice[]>> = {
  belgium: belgiumChoices(),
  winter: winterChoices(),
  brasil: brasilChoices(),
};

/** The ticket options for an edition, in the data file's own order. */
export function ticketChoicesFor(edition: ToolEdition): readonly TicketChoice[] {
  return CHOICES[edition];
}

/** Looks an option up by id, returning undefined for an id from another edition. */
export function findTicketChoice(
  edition: ToolEdition,
  id: string,
): TicketChoice | undefined {
  return CHOICES[edition].find((choice) => choice.id === id);
}

/**
 * The option a state falls back to when its stored ticket id is not valid for
 * the edition, typically because the edition was switched in another tab.
 */
export function defaultTicketId(edition: ToolEdition): string {
  return CHOICES[edition][0]?.id ?? CUSTOM_TICKET_ID;
}

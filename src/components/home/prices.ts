/**
 * The "from" price on an edition card, and nothing more.
 *
 * An edition card shows one figure per edition, and only when the data holds a
 * figure that actually answers "what is the cheapest way in?". Everything else
 * is deliberately absent: no euro figure is ever derived from a reais one, no
 * price is carried over from an earlier edition, and an edition with no
 * published price shows its status instead of a number.
 *
 * Each picker takes the collection as a parameter so the rule can be tested
 * against hand-made records, and the `edition…Price` wrappers read the real,
 * already-validated data.
 */
import { belgiumData } from "@/data/belgium";
import { brasilData, type BrasilTicket } from "@/data/brasil";
import { winterData } from "@/data/winter";
import type { Source, TicketPackage } from "@/data/schemas";
import { formatEuroFrom, formatReaisFrom } from "./format";

/** A single figure, with everything needed to present it honestly. */
export interface FromPrice {
  /** The amount exactly as displayed, for example "€159" or "R$1,270". */
  readonly amountLabel: string;
  /** What the reader gets for it, for example "Day Pass". */
  readonly productLabel: string;
  /** Which sale the figure comes from, for example "WorldWide Ticket Sale". */
  readonly saleLabel: string | null;
  /** Anything that changes how the figure should be read. */
  readonly note: string | null;
  /** True when the product is sold out, so the figure is a past price. */
  readonly soldOut: boolean;
  readonly source: Source;
  readonly lastVerified: string;
}

/**
 * Splits a Belgium ticket name into its three parts. The names follow one
 * written shape, "Day Pass — 2027 edition, WorldWide Ticket Sale", so this is
 * reading published data rather than guessing at it. A name in another shape
 * yields the whole name as the product and null for the rest, and nothing in
 * that shape is eligible for the card, so no figure is mislabelled.
 */
export function splitTicketName(name: string): {
  product: string;
  editionPart: string | null;
  salePart: string | null;
} {
  const [product, rest] = name.split(" — ");
  if (rest === undefined) {
    return { product: name.trim(), editionPart: null, salePart: null };
  }
  const [editionPart, salePart] = rest.split(", ");
  return {
    product: product.trim(),
    editionPart: editionPart?.trim() ?? null,
    salePart: salePart?.trim() ?? null,
  };
}

/** The products a Belgium "from" figure may quote. */
const BELGIUM_PRODUCTS = new Set(["Day Pass", "Full Madness Pass"]);

/** The sale whose prices a Belgium "from" figure quotes. */
const BELGIUM_SALE = "WorldWide Ticket Sale";

/**
 * Belgium's cheapest way in, from the WorldWide Ticket Sale: the lower of the
 * Day Pass and the Full Madness Pass, both regular tier.
 *
 * Pre-sale figures, Pleasure and Comfort upgrades, and DreamVille packages are
 * excluded on purpose. A "from" figure that quoted a pre-sale price would be out
 * of date the moment the general sale opens, and one that quoted a package
 * would answer a different question.
 *
 * @returns null when the data holds no qualifying price.
 */
export function pickBelgiumFrom(tickets: readonly TicketPackage[]): FromPrice | null {
  const eligible = tickets
    .map((ticket) => ({ ticket, parts: splitTicketName(ticket.name) }))
    .filter(({ parts }) => parts.salePart === BELGIUM_SALE && BELGIUM_PRODUCTS.has(parts.product));

  if (eligible.length === 0) return null;

  // Cheapest wins; the id breaks a tie so the card cannot change between builds.
  const chosen = eligible.reduce((best, candidate) => {
    if (candidate.ticket.priceEur < best.ticket.priceEur) return candidate;
    if (candidate.ticket.priceEur > best.ticket.priceEur) return best;
    return candidate.ticket.id < best.ticket.id ? candidate : best;
  });

  return {
    amountLabel: formatEuroFrom(chosen.ticket.priceEur),
    productLabel: chosen.parts.product,
    saleLabel: chosen.parts.salePart,
    note: null,
    soldOut: false,
    source: chosen.ticket.source,
    lastVerified: chosen.ticket.lastVerified,
  };
}

/**
 * Winter's cheapest published ticket, or null when the data holds none.
 *
 * Winter publishes one 2027 price, for the 7-Day Festival Ticket, which
 * includes the lift and ski pass the mountain stages need. The 4-Day and 1-Day
 * tickets are listed on the official pages without a price an unauthenticated
 * reader can see, so they are absent from the data rather than quoted at a
 * guess, and an empty collection honestly yields no figure.
 */
export function pickWinterFrom(tickets: readonly TicketPackage[]): FromPrice | null {
  if (tickets.length === 0) return null;

  const chosen = tickets.reduce((best, candidate) => {
    if (candidate.priceEur < best.priceEur) return candidate;
    if (candidate.priceEur > best.priceEur) return best;
    return candidate.id < best.id ? candidate : best;
  });

  return {
    amountLabel: formatEuroFrom(chosen.priceEur),
    productLabel: chosen.name,
    saleLabel: null,
    note: null,
    soldOut: false,
    source: chosen.source,
    lastVerified: chosen.lastVerified,
  };
}

/** Brasil variants that are not a general-admission price. */
const BRASIL_EXCLUDED_VARIANTS = new Set([
  "half-price",
  "social",
  "bybit-early-bird",
  "bybit-early-bird-half-price",
  "bybit-early-bird-social",
]);

/**
 * Brasil's cheapest general-admission ticket, in reais.
 *
 * Half-price, Social and Bybit Early Bird rows are excluded because each one
 * needs something the reader may not have: Brazilian citizenship proved at the
 * gate, an eligibility document, or a sale moment that has already closed.
 * Reais stay reais, because no official source publishes a rate.
 */
export function pickBrasilFrom(tickets: readonly BrasilTicket[]): FromPrice | null {
  const eligible = tickets.filter((ticket) => !BRASIL_EXCLUDED_VARIANTS.has(ticket.variant));
  if (eligible.length === 0) return null;

  const chosen = eligible.reduce((best, candidate) => {
    if (candidate.price.amount < best.price.amount) return candidate;
    if (candidate.price.amount > best.price.amount) return best;
    return candidate.id < best.id ? candidate : best;
  });

  return {
    amountLabel: formatReaisFrom(chosen.price.amount),
    productLabel: chosen.name,
    saleLabel: null,
    note: "Prices in reais, as published. No euro equivalent is published.",
    soldOut: chosen.availability === "sold-out",
    source: chosen.source,
    lastVerified: chosen.lastVerified,
  };
}

/** Belgium's card figure, read from the validated data. */
export function belgiumFromPrice(): FromPrice | null {
  return pickBelgiumFrom(belgiumData.tickets);
}

/** Winter's card figure, read from the validated data. */
export function winterFromPrice(): FromPrice | null {
  return pickWinterFrom(winterData.tickets);
}

/** Brasil's card figure, read from the validated data. */
export function brasilFromPrice(): FromPrice | null {
  return pickBrasilFrom(brasilData.tickets);
}

import type { SearchKind } from "./types";

/**
 * Kind metadata: the fixed order of the result headings and the label shown on
 * each row.
 *
 * Kept apart from `build.ts` on purpose. `build.ts` imports every data file;
 * this module imports nothing, so a Client Component can show headings and
 * labels without pulling the datasets into the browser bundle.
 */
export const KIND_ORDER: readonly SearchKind[] = [
  "page",
  "guide",
  "sale",
  "ticket",
  "accommodation",
  "edition",
  "faq",
  "whatsapp",
  "resource",
  "partner",
];

export const KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  page: "Page",
  guide: "Guide",
  sale: "Sale",
  ticket: "Ticket",
  accommodation: "Accommodation",
  edition: "Edition",
  faq: "FAQ",
  whatsapp: "WhatsApp",
  resource: "Resource",
  partner: "Partner",
};

/** The id prefix per kind, so two source lists cannot produce the same id. */
export function kindPrefix(kind: SearchKind): string {
  return kind === "accommodation" ? "stay" : kind;
}

import type { Accommodation } from "../schemas";

/**
 * Winter 2027 accommodation: intentionally empty.
 *
 * `accommodationSchema` requires a price (`nightlyOrTotalEur`) and a capacity
 * per property. For Winter 2027 no accommodation price is published: the 4-
 * and 7-Day Package sale shows "Sold out" with no minimum price, and lodging is
 * sold only inside a package. Naming individual hotels at an invented price
 * would breach the no-estimate rule, so nothing is recorded here.
 *
 * The verified structure that does exist (four package categories, Wood,
 * Bronze, Silver and Gold, over hotels, apartments and shared chalets) has no
 * field in this schema. See `docs/data/winter-omissions.md`.
 */
export const winterAccommodation: readonly Accommodation[] = [];

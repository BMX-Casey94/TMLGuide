import type { Locker } from "../schemas";

/**
 * Winter 2027 lockers: intentionally empty.
 *
 * `lockerSchema` requires a price, and no 2027 Winter locker price is published
 * on any official page — the page itself defers the price table. `conflicts.md`
 * (item 4) confirms the mechanics (three locker areas at the Main Entrance, the
 * Cage and the MainStage; rentable in advance for 4 or 7 days; single-day
 * lockers reservable in advance only for the Saturday–Monday pre-days) and the
 * 2027 dimensions, but records "none published officially" for price. The
 * schema has no field for dimensions or access hours either.
 *
 * See `docs/data/winter-omissions.md`.
 */
export const winterLockers: readonly Locker[] = [];

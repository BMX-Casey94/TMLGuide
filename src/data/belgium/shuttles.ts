import type { Shuttle } from "../schemas";

/**
 * Paid transfers for Belgium 2027.
 *
 * Intentionally empty. The `shuttle` schema requires a `priceEur`, and no 2027
 * fare exists: the ledger confirms the airport routes (Brussels Airport,
 * Brussels South Charleroi and Eindhoven), the Thursday-in/Monday-out pattern
 * and the city-shuttle product, but every fare it records is either
 * `unverifiable` or a 2025/2026 figure. There is no corrected 2027 value to
 * publish, and a 2025 fare must not be carried forward, so the routes are
 * listed in `docs/data/belgium-omissions.md` until 2027 prices appear.
 */
export const shuttles: readonly Shuttle[] = [];

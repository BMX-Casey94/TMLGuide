import type { PearlBundle } from "../schemas";

/**
 * Pearl top-up bundles for Belgium 2027.
 *
 * Intentionally empty, for two reasons.
 *
 * 1. No 2027 Pearl rate is published. Tomorrowland says the value of one Pearl
 *    will be announced around June before the festival, so every euro-to-Pearl
 *    figure for 2027 is unknown.
 * 2. The 2026 figures cannot be carried forward. That year's rate was €1.90,
 *    so €20 bought 10.5 Pearls, and the schema requires `pearls` to be a whole
 *    number. The confirmed 2026 bonus tiers (€100 buys two extra Pearls, and so
 *    on) are bonuses rather than bundles and would need a field the schema does
 *    not have.
 *
 * See `docs/data/belgium-omissions.md`.
 */
export const pearlBundles: readonly PearlBundle[] = [];

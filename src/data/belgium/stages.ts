import type { Stage } from "../schemas";

/**
 * Stages for Belgium 2027.
 *
 * Intentionally empty. The official homepage states that the festival has 16
 * stages — recorded in `facts.ts` — but publishes no 2027 stage list. The only
 * stage names anywhere in the ledger are Melodia and Freedom, mentioned in
 * passing in the Avicii Tribute description, and a stage record needs a name, a
 * kind and a description that no source supplies. Building one would mean
 * inventing it. See `docs/data/belgium-omissions.md`.
 */
export const stages: readonly Stage[] = [];

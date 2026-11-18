/**
 * Where corrections should be sent.
 *
 * There is no corrections address in this repository yet, and inventing one
 * would put a dead mailto link in front of readers who are trying to get a wrong
 * fact fixed. So the About page reads this constant and renders a contact route
 * only when it holds something.
 *
 * To add one, set it to the address readers should write to, for example:
 *
 *     export const CORRECTIONS_EMAIL: string | null = "corrections@tmlguide.com";
 *
 * The page then renders the address as a `mailto:` link on its own line. No
 * other change is needed, and nothing renders while this is null.
 */
export const CORRECTIONS_EMAIL: string | null = null;

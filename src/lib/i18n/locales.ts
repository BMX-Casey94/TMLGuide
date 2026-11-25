/**
 * Phased internationalisation (i18n) locale registry for TMLGuide.
 *
 * `en-GB` is the live canonical edition. The five additional festival-audience
 * locales are registered as `"planned"` so navigation, hreflang metadata and
 * untranslated-page notices share a single source of truth as translations roll out.
 */

export type LocaleCode = "en-GB" | "nl" | "fr" | "de" | "es" | "pt-BR";

export type LocaleStatus = "live" | "planned";

export interface LocaleDefinition {
  readonly code: LocaleCode;
  readonly nativeLabel: string;
  readonly englishLabel: string;
  readonly hreflang: LocaleCode;
  readonly status: LocaleStatus;
  readonly dir: "ltr" | "rtl";
}

export const DEFAULT_LOCALE: LocaleCode = "en-GB";

export const LOCALES: readonly LocaleDefinition[] = [
  {
    code: "en-GB",
    nativeLabel: "English (UK)",
    englishLabel: "English (UK)",
    hreflang: "en-GB",
    status: "live",
    dir: "ltr",
  },
  {
    code: "nl",
    nativeLabel: "Nederlands",
    englishLabel: "Dutch",
    hreflang: "nl",
    status: "planned",
    dir: "ltr",
  },
  {
    code: "fr",
    nativeLabel: "Français",
    englishLabel: "French",
    hreflang: "fr",
    status: "planned",
    dir: "ltr",
  },
  {
    code: "de",
    nativeLabel: "Deutsch",
    englishLabel: "German",
    hreflang: "de",
    status: "planned",
    dir: "ltr",
  },
  {
    code: "es",
    nativeLabel: "Español",
    englishLabel: "Spanish",
    hreflang: "es",
    status: "planned",
    dir: "ltr",
  },
  {
    code: "pt-BR",
    nativeLabel: "Português (Brasil)",
    englishLabel: "Portuguese (Brazil)",
    hreflang: "pt-BR",
    status: "planned",
    dir: "ltr",
  },
] as const;

export const LIVE_LOCALES: readonly LocaleDefinition[] = LOCALES.filter(
  (locale) => locale.status === "live",
);

export const PLANNED_LOCALES: readonly LocaleDefinition[] = LOCALES.filter(
  (locale) => locale.status === "planned",
);

const localeByNormalisedCode = new Map<string, LocaleDefinition>(
  LOCALES.map((locale) => [locale.code.toLowerCase(), locale]),
);

/**
 * Looks up a registered locale by BCP 47 code (case-insensitive, e.g. `"pt-br"`
 * matches `"pt-BR"`). Returns `undefined` for unregistered codes.
 */
export function getLocale(code: string): LocaleDefinition | undefined {
  if (typeof code !== "string") {
    return undefined;
  }
  return localeByNormalisedCode.get(code.trim().toLowerCase());
}

/**
 * Returns `true` only when the given code matches a registered locale whose
 * status is `"live"`.
 */
export function isLiveLocale(code: string): boolean {
  return getLocale(code)?.status === "live";
}

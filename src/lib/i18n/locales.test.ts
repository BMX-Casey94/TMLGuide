import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  getLocale,
  isLiveLocale,
  LIVE_LOCALES,
  LOCALES,
  PLANNED_LOCALES,
} from "./locales";

describe("i18n locale registry", () => {
  it("registers all 6 planned locales with en-GB as the default live locale", () => {
    expect(DEFAULT_LOCALE).toBe("en-GB");
    expect(LOCALES).toHaveLength(6);
    expect(LOCALES.map((locale) => locale.code)).toEqual([
      "en-GB",
      "nl",
      "fr",
      "de",
      "es",
      "pt-BR",
    ]);
  });

  it("partitions live and planned locales cleanly", () => {
    expect(LIVE_LOCALES.map((locale) => locale.code)).toEqual(["en-GB"]);
    expect(PLANNED_LOCALES.map((locale) => locale.code)).toEqual([
      "nl",
      "fr",
      "de",
      "es",
      "pt-BR",
    ]);
  });

  it("looks up locales case-insensitively and returns undefined for unknown codes", () => {
    expect(getLocale("en-GB")?.nativeLabel).toBe("English (UK)");
    expect(getLocale("pt-br")?.nativeLabel).toBe("Português (Brasil)");
    expect(getLocale("NL")?.hreflang).toBe("nl");
    expect(getLocale("ja")).toBeUndefined();
    expect(getLocale("")).toBeUndefined();
  });

  it("reports isLiveLocale accurately", () => {
    expect(isLiveLocale("en-GB")).toBe(true);
    expect(isLiveLocale("en-gb")).toBe(true);
    expect(isLiveLocale("nl")).toBe(false);
    expect(isLiveLocale("fr")).toBe(false);
    expect(isLiveLocale("de")).toBe(false);
    expect(isLiveLocale("es")).toBe(false);
    expect(isLiveLocale("pt-BR")).toBe(false);
    expect(isLiveLocale("unknown")).toBe(false);
  });
});

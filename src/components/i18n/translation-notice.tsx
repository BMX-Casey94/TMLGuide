import Link from "next/link";
import { getLocale, isLiveLocale } from "@/lib/i18n/locales";
import "./i18n.css";

export interface TranslationNoticeProps {
  /** Requested or active locale code (for example `"nl"` or `"pt-BR"`). */
  locale: string;
  /** Path to the canonical English (UK) version of the page. Defaults to `"/"`. */
  englishHref?: string;
  /**
   * Set to `true` when a live locale has sections that have not yet been
   * translated. Ignored when the locale is already non-live.
   */
  partial?: boolean;
}

/**
 * Accessible notice displayed when viewing a planned (not yet live) or
 * partially translated locale. Returns `null` for live, fully translated pages.
 */
export function TranslationNotice({
  locale,
  englishHref = "/",
  partial = false,
}: TranslationNoticeProps) {
  const live = isLiveLocale(locale);
  if (live && !partial) {
    return null;
  }

  const definition = getLocale(locale);
  const languageLabel = definition
    ? `${definition.nativeLabel} (${definition.englishLabel})`
    : locale;

  const message =
    live && partial
      ? `Some sections of this page are not yet translated into ${languageLabel} and are currently shown in English.`
      : `This page is currently in English. A ${languageLabel} translation is planned for a future release.`;

  return (
    <aside className="tml-i18n-notice" role="note" aria-label="Translation notice">
      <p className="tml-i18n-notice__body">
        <span className="tml-i18n-notice__label">Language notice</span>
        {message}
      </p>
      <Link href={englishHref} className="tml-i18n-notice__link">
        View English version
      </Link>
    </aside>
  );
}

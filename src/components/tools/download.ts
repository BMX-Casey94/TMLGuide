/**
 * Browser download helpers for the tool pages.
 *
 * A Blob URL rather than a data URI: a calendar file is a document the browser
 * should save with a filename, and a data URI on a large file is rejected by
 * every modern browser. The URL is revoked once the download has started, so a
 * series of exports cannot leak memory.
 */

/** MIME type for an iCalendar file, with the charset RFC 5545 recommends. */
const ICS_MIME = "text/calendar;charset=utf-8";

/**
 * Saves text as a file the visitor's browser downloads.
 *
 * @param filename - Suggested name. The caller is responsible for making it
 *   safe; `icsFilename` in the tools library strips anything outside `a-z0-9-`.
 * @returns true when the download was triggered, false when the browser has no
 *   Blob URL support, so the caller can offer the text another way.
 */
export function downloadTextFile(filename: string, text: string, mime = ICS_MIME): boolean {
  if (typeof document === "undefined") return false;

  let url: string;
  try {
    const blob = new Blob([text], { type: mime });
    url = URL.createObjectURL(blob);
  } catch {
    return false;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  // The anchor is never in the layout, so it needs no styling or focus handling.
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  /*
    Revoking immediately can cancel the download in some browsers, so it is
    deferred by one turn. The timeout is intentional rather than a race: the
    click has already handed the URL to the download manager by then.
  */
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);

  return true;
}

/**
 * A dependency-free RFC 5545 calendar writer for the TMLGUIDE planning tools.
 *
 * The output is deliberately narrow: published calendar files with UTC
 * date-times and optional display alarms. Everything a caller can influence
 * (product id, UID, summary, description, location, URL) passes through a
 * sanitiser, because a value containing CR/LF would otherwise end the current
 * property and start a new one. A calendar file is opened by a mail or calendar
 * client, so an injected `ATTENDEE:` or `BEGIN:VTIMEZONE` line would be a real
 * forgery primitive rather than a cosmetic bug.
 */

import { formatUtcStamp, parseInstant } from "./instant";

const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const MAX_LINE_OCTETS = 75;
const MAX_FILENAME_LENGTH = 60;

/** One event in the published calendar. */
export interface IcsEvent {
  /** Globally unique identifier. Callers usually supply a UID already. */
  readonly uid: string;
  /** Event title, shown in the client's agenda. */
  readonly summary: string;
  readonly description?: string;
  readonly location?: string;
  /** Start instant as ISO 8601 with an explicit offset or `Z`. */
  readonly startIso: string;
  /**
   * End instant as ISO 8601 with an explicit offset or `Z`. Defaults to one
   * hour after the start when omitted.
   */
  readonly endIso?: string;
  /** Whole minutes before the start at which to raise a display alarm. */
  readonly alarmMinutesBefore?: readonly number[];
  /** Absolute http, https or webcal address for the event. */
  readonly url?: string;
}

/** Input for {@link buildIcs}. */
export interface IcsCalendarInput {
  /** RFC 5545 PRODID, for example "-//TMLGUIDE//Planning tools//EN". */
  readonly productId: string;
  readonly events: readonly IcsEvent[];
  /** The moment the calendar file is generated, used for DTSTAMP. */
  readonly now: Date;
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Removes characters that cannot appear in a property value. Tabs are legal in
 * TEXT values and are kept; every other C0 control and DEL is dropped.
 */
function stripControlCharacters(value: string): string {
  return value.replace(CONTROL_CHARACTERS, "");
}

/**
 * Escapes a TEXT value as RFC 5545 section 3.3.11 requires: backslash, semicolon
 * and comma are escaped, and every line break becomes the two characters `\n`.
 * Because line breaks stop being line breaks, no value can introduce a new
 * property line.
 */
function escapeText(value: string): string {
  const flattened = stripControlCharacters(value.replace(/\r\n|\r|\n/g, "\n"));
  return flattened
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Folds one content line at 75 octets without splitting a character.
 *
 * Continuation lines start with a single space, which counts towards the 75, so
 * they carry 74 octets of content. A trailing backslash is carried onto the
 * continuation line rather than left dangling, so an escape sequence never spans
 * a fold.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const characters = Array.from(line);
  const segments: string[] = [];
  let current: string[] = [];
  let currentBytes = 0;
  let limit = MAX_LINE_OCTETS;

  const flush = (): void => {
    segments.push(current.join(""));
    current = [];
    currentBytes = 0;
    limit = MAX_LINE_OCTETS - 1;
  };

  // A dangling single trailing backslash means the previous character opened an
  // escape pair; carrying it to the next line keeps the pair intact.
  const carryBackslash = (): boolean => {
    let trailing = 0;
    for (let index = current.length - 1; index >= 0 && current[index] === "\\"; index -= 1) {
      trailing += 1;
    }
    return trailing % 2 === 1;
  };

  for (const character of characters) {
    const size = encoder.encode(character).length;

    if (currentBytes + size > limit && current.length > 0) {
      if (carryBackslash() && current.length > 1) {
        current.pop();
        flush();
        current.push("\\");
        currentBytes = 1;
      } else {
        flush();
      }
    }

    current.push(character);
    currentBytes += size;
  }

  if (current.length > 0) {
    segments.push(current.join(""));
  }

  return segments.join("\r\n ");
}

function contentLine(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function assertText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new RangeError(`${label} must be a string`);
  }
  if (value.trim() === "") {
    throw new RangeError(`${label} must not be empty`);
  }
  return value;
}

function validateEvents(events: readonly IcsEvent[]): void {
  if (!Array.isArray(events)) {
    throw new RangeError("events must be an array");
  }

  const seen = new Set<string>();
  events.forEach((event, index) => {
    if (event === null || typeof event !== "object") {
      throw new RangeError(`event at index ${index} must be an object`);
    }

    const uid = assertText(event.uid, `event at index ${index} needs a uid`).trim();
    if (seen.has(uid)) {
      throw new RangeError(`event uid "${uid}" appears more than once`);
    }
    seen.add(uid);

    assertText(event.summary, `event "${uid}" needs a summary`);

    const start = parseInstant(event.startIso, `the start of event "${uid}"`);
    if (event.endIso !== undefined) {
      const end = parseInstant(event.endIso, `the end of event "${uid}"`);
      if (end < start) {
        throw new RangeError(`event "${uid}" ends before it starts`);
      }
    }

    const alarms = event.alarmMinutesBefore;
    if (alarms !== undefined) {
      if (!Array.isArray(alarms)) {
        throw new RangeError(`the alarms of event "${uid}" must be an array of minutes`);
      }
      for (const minutes of alarms) {
        if (typeof minutes !== "number" || !Number.isSafeInteger(minutes) || minutes < 0) {
          throw new RangeError(
            `event "${uid}" has an invalid alarm offset ${String(minutes)}; use a whole number of minutes`,
          );
        }
      }
    }

    if (event.url !== undefined) {
      assertUrl(event.url, uid);
    }
  });
}

function assertUrl(value: unknown, uid: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RangeError(`the url of event "${uid}" must be a non-empty string`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RangeError(`the url of event "${uid}" is not an absolute URL`);
  }

  if (!["http:", "https:", "webcal:"].includes(parsed.protocol)) {
    throw new RangeError(
      `the url of event "${uid}" must use http, https or webcal, received ${parsed.protocol}`,
    );
  }
  // Credentials in a published calendar would be handed to every subscriber.
  if (parsed.username !== "" || parsed.password !== "") {
    throw new RangeError(`the url of event "${uid}" must not contain credentials`);
  }
}

function eventLines(event: IcsEvent, now: Date): string[] {
  const start = parseInstant(event.startIso, `the start of event "${event.uid}"`);
  const end =
    event.endIso === undefined
      ? start + DEFAULT_DURATION_MS
      : parseInstant(event.endIso, `the end of event "${event.uid}"`);

  const lines: string[] = [
    "BEGIN:VEVENT",
    contentLine("UID", escapeText(event.uid)),
    contentLine("DTSTAMP", formatUtcStamp(now.getTime())),
    contentLine("DTSTART", formatUtcStamp(start)),
    contentLine("DTEND", formatUtcStamp(end)),
    contentLine("SUMMARY", escapeText(event.summary)),
  ];

  if (event.description !== undefined && event.description !== "") {
    lines.push(contentLine("DESCRIPTION", escapeText(event.description)));
  }
  if (event.location !== undefined && event.location !== "") {
    lines.push(contentLine("LOCATION", escapeText(event.location)));
  }
  if (event.url !== undefined) {
    // A URI is not a TEXT value, so its commas and semicolons stay as written;
    // only characters that could end the property line are removed.
    const url = event.url.replace(/[\r\n\u0000-\u001F\u007F]/g, "");
    lines.push(contentLine("URL", url));
  }

  const alarms = [...new Set(event.alarmMinutesBefore ?? [])].sort((a, b) => a - b);
  for (const minutes of alarms) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      contentLine("TRIGGER", `-PT${String(minutes)}M`),
      contentLine("DESCRIPTION", escapeText(`Reminder: ${event.summary}`)),
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * Builds a complete RFC 5545 calendar as a string with CRLF line endings.
 *
 * All date-times are written in UTC (`YYYYMMDDTHHMMSSZ`). An event without an
 * end time lasts one hour.
 *
 * @throws RangeError when the product id is missing, `now` is not a valid Date,
 * an event has no uid or summary, a date is unparseable or lacks an offset, an
 * event ends before it starts, a UID repeats, an alarm offset is not a whole
 * number of minutes, or a URL is not an absolute http, https or webcal address.
 */
export function buildIcs(input: IcsCalendarInput): string {
  if (input === null || typeof input !== "object") {
    throw new RangeError("buildIcs needs an input object");
  }
  const { productId, events, now } = input;

  const product = assertText(productId, "productId");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new RangeError("now must be a valid Date");
  }
  validateEvents(events);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    contentLine("PRODID", escapeText(product)),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(...eventLines(event, now));
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Turns a human title into a safe download filename: lowercase, kebab case,
 * nothing outside `a-z0-9-`, at most 60 characters including the extension.
 * Returns "calendar.ics" when nothing usable survives.
 *
 * The result is a filename only, never a path: separators cannot survive the
 * filter, so it cannot escape the directory it is written to.
 */
export function icsFilename(name: string): string {
  const source = typeof name === "string" ? name : "";
  const extension = ".ics";

  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_FILENAME_LENGTH - extension.length)
    .replace(/-$/g, "");

  return slug === "" ? `calendar${extension}` : `${slug}${extension}`;
}

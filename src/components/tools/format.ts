import { toolCurrencySchema, type ToolCurrency } from "./editions";

/**
 * Money handling for the tool pages.
 *
 * Every amount is carried as an integer number of minor units (euro cents, or
 * centavos for reais) so totals are exact. The tools never convert between
 * currencies: the figure a reader types is in the edition's own currency, and
 * that is the only currency it is ever shown in.
 */

export type { ToolCurrency };

/** The largest amount a single field accepts, in major units. */
export const MAX_MAJOR_UNITS = 1_000_000;

/** The same ceiling in minor units, used to reject oversized input. */
export const MAX_MINOR_UNITS = MAX_MAJOR_UNITS * 100;

/** Groups digits with thousands separators, keeping at most two decimals. */
const bareFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats minor units as a bare grouped number, for example "1,234.50". */
export function formatAmount(minorUnits: number): string {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError(`minor units must be a safe integer, received ${String(minorUnits)}`);
  }
  return bareFormatter.format(minorUnits / 100);
}

/**
 * Formats minor units with the currency symbol and exactly two decimals:
 * "€1,234.56" for euros, "R$1,234.00" for reais.
 *
 * The currency is always supplied by the caller, never inferred from a locale,
 * so a Brasil figure cannot be labelled in euros by accident.
 */
export function formatMoney(minorUnits: number, currency: ToolCurrency): string {
  const parsed = toolCurrencySchema.safeParse(currency);
  if (!parsed.success) {
    throw new RangeError(`currency must be "EUR" or "BRL", received ${String(currency)}`);
  }
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError(`minor units must be a safe integer, received ${String(minorUnits)}`);
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: parsed.data,
  }).format(minorUnits / 100);
}

/** The symbol for a currency, used beside a field that asks for a bare amount. */
export function currencySymbol(currency: ToolCurrency): string {
  return currency === "BRL" ? "R$" : "€";
}

/** Why a typed amount could not be read. Rendered beside the field. */
export type AmountProblem = "not-a-number" | "negative" | "too-precise" | "too-large";

export type AmountParseResult =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid"; readonly problem: AmountProblem }
  | { readonly kind: "valid"; readonly minorUnits: number };

/**
 * A grouped integer: digits with optional groups of exactly three separated by
 * a single repeated separator, for example "1" or "1,234,567".
 *
 * A grouped number never starts with a zero, so "0.333" is a decimal with three
 * places rather than a grouped three hundred and thirty-three.
 */
function isGroupedInteger(value: string, separator: string): boolean {
  if (value === "") return true;
  if (/^\d+$/.test(value)) return true;
  if (/^0[.,]/.test(value)) return false;
  const escaped = separator === "." ? "\\." : ",";
  return new RegExp(`^[1-9]\\d{0,2}(?:${escaped}\\d{3})+$`).test(value);
}

/**
 * Removes grouping marks from an already-validated integer part.
 *
 * The grouping marks are validated first, so this only discards separators that
 * sit in the right places; it never repairs a malformed number.
 */
function ungroup(value: string, separator: string): string {
  return value.split(separator).join("");
}

/**
 * Reads a typed amount into minor units.
 *
 * Accepts what a person actually types: an optional currency symbol or code, a
 * thousands separator, and either a dot or a comma as the decimal mark. A space
 * counts as a thousands separator only when it sits between three-digit groups,
 * so "1 234,56" reads correctly while "1 2" is refused rather than becoming 12.
 *
 * Empty input is its own result rather than zero, so a field can tell "not
 * filled in" from "deliberately nothing". Nothing is rounded: a third decimal
 * place is an error rather than something to quietly discard.
 *
 * The parse runs in four steps, so each rejection has exactly one cause:
 * normalise the text, decide which mark (if any) is the decimal mark, validate
 * and ungroup the integer part, then validate the fraction.
 */
export function parseAmountInput(text: string): AmountParseResult {
  if (typeof text !== "string") return { kind: "invalid", problem: "not-a-number" };

  // 1. Normalise: drop a currency symbol or code, then every space that groups
  // thousands. A space is only a grouping mark between digit groups of three.
  const withoutCurrency = text
    .trim()
    .replace(/^(?:R\$|€|EUR|BRL)\s*/i, "");

  if (withoutCurrency.trim() === "") return { kind: "empty" };

  // A space or non-breaking space followed by exactly three digits is grouping.
  const grouped = withoutCurrency.replace(/[\s\u00A0](?=\d{3}(?:$|[.,\s\u00A0]))/g, "");
  // Any space left over is not a grouping mark, so the text is not a number.
  if (/\s/.test(grouped)) return { kind: "invalid", problem: "not-a-number" };

  const negative = grouped.startsWith("-");
  const unsigned = negative ? grouped.slice(1) : grouped;

  // Nothing but digits and the two separators may appear.
  if (unsigned === "" || !/^[\d.,]+$/.test(unsigned)) {
    return { kind: "invalid", problem: "not-a-number" };
  }

  // 2. Decide the decimal mark. A separator is a decimal mark only when it
  // appears once and is followed by one or two digits; otherwise it groups
  // thousands. When both marks appear the later one is the decimal mark and the
  // earlier one must be grouping the thousands.
  const lastDot = unsigned.lastIndexOf(".");
  const lastComma = unsigned.lastIndexOf(",");
  const dotCount = unsigned.split(".").length - 1;
  const commaCount = unsigned.split(",").length - 1;

  let integerText = "";
  let fractionText = "";

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalMark = lastDot > lastComma ? "." : ",";
    const groupingMark = decimalMark === "." ? "," : ".";
    const decimalAt = unsigned.lastIndexOf(decimalMark);
    integerText = unsigned.slice(0, decimalAt);
    fractionText = unsigned.slice(decimalAt + 1);

    // A mark cannot serve both roles, so the grouping mark must not appear in
    // the fraction.
    if (fractionText.includes(groupingMark)) {
      return { kind: "invalid", problem: "not-a-number" };
    }
    if (!isGroupedInteger(integerText, groupingMark)) {
      return { kind: "invalid", problem: "not-a-number" };
    }
    integerText = ungroup(integerText, groupingMark);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const mark = lastDot >= 0 ? "." : ",";
    const count = lastDot >= 0 ? dotCount : commaCount;
    const digitsAfter = unsigned.length - unsigned.lastIndexOf(mark) - 1;

    if (count === 1 && digitsAfter <= 2) {
      // One separator followed by one or two digits: a decimal mark.
      const at = unsigned.lastIndexOf(mark);
      integerText = unsigned.slice(0, at);
      fractionText = unsigned.slice(at + 1);
    } else if (count === 1 && /^0[.,]/.test(unsigned)) {
      // "0.333" is a decimal, not a grouped integer: a grouped number never
      // starts with a zero. Its three places are the precise complaint.
      return { kind: "invalid", problem: "too-precise" };
    } else if (digitsAfter === 3) {
      // Three digits after the separator means it groups thousands, not a
      // decimal ("1,234" is one thousand two hundred and thirty-four).
      if (!isGroupedInteger(unsigned, mark)) {
        return { kind: "invalid", problem: "not-a-number" };
      }
      integerText = ungroup(unsigned, mark);
      fractionText = "";
    } else if (count === 1) {
      // One separator with four or more digits after it is a decimal with too
      // many places, which is worth saying precisely.
      return { kind: "invalid", problem: "too-precise" };
    } else {
      // Repeated separators without three-digit groups are simply malformed.
      return { kind: "invalid", problem: "not-a-number" };
    }
  } else {
    integerText = unsigned;
  }

  // 3. The integer part must be a run of digits. A bare separator leaves nothing
  // behind, which is not a number.
  if (integerText === "") return { kind: "invalid", problem: "not-a-number" };
  if (!/^\d+$/.test(integerText)) return { kind: "invalid", problem: "not-a-number" };

  // 4. The fraction must be digits, and at most two of them.
  if (!/^\d*$/.test(fractionText)) return { kind: "invalid", problem: "not-a-number" };
  if (fractionText.length > 2) return { kind: "invalid", problem: "too-precise" };

  // A negative amount would only be meaningful as a discount line, which this
  // tool does not offer, so it is refused rather than quietly flipped positive.
  if (negative) return { kind: "invalid", problem: "negative" };

  const majorUnits = Number(integerText);
  if (!Number.isSafeInteger(majorUnits)) return { kind: "invalid", problem: "too-large" };

  const minorUnits = majorUnits * 100 + Number(fractionText.padEnd(2, "0"));
  if (!Number.isSafeInteger(minorUnits) || minorUnits > MAX_MINOR_UNITS) {
    return { kind: "invalid", problem: "too-large" };
  }

  return { kind: "valid", minorUnits };
}

/** A message for each problem, written for the reader rather than the developer. */
export const AMOUNT_PROBLEM_MESSAGE: Readonly<Record<AmountProblem, string>> = {
  "not-a-number": "Enter an amount in numbers, for example 120 or 120.50.",
  negative: "Amounts cannot be negative.",
  "too-precise": "Use at most two decimal places, for example 120.50.",
  "too-large": "That amount is larger than this tool accepts. Check the figure.",
};

/**
 * Reads a whole number within inclusive bounds, or null when the text is not
 * one. Used for the group size, which multiplies every line in the budget.
 */
export function parseWholeNumber(text: string, min: number, max: number): number | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < min || value > max) return null;
  return value;
}

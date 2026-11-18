/**
 * Money helpers for the TMLGUIDE planning tools.
 *
 * Festival prices are quoted in euros (EUR). British pounds (GBP) are always an
 * indicative conversion at a rate supplied by the caller; this module never
 * assumes a rate and never fetches one.
 *
 * Every amount is an integer number of minor units internally (euro cents or
 * pence). Floating point is only used at the boundary where a caller passes a
 * euro amount such as `19.99`; the conversion is checked so that a value with
 * more than two decimal places is rejected rather than silently rounded.
 */

const CENTS_PER_EURO = 100;
const CURRENCY_LOCALE = "en-GB";

const euroFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: "EUR",
});

const poundFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: "GBP",
});

/**
 * Eight times the machine epsilon, scaled by the magnitude of the value. This
 * is the size of the rounding noise introduced by a single multiplication of a
 * double, so anything within it is a representation artefact rather than a
 * third decimal place.
 */
function noiseTolerance(scaled: number): number {
  return 8 * Number.EPSILON * Math.max(1, Math.abs(scaled));
}

function assertSafeInteger(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer, received ${String(value)}`);
  }
}

/**
 * Converts a positive decimal rate into an exact fraction using its shortest
 * round-trip decimal representation ("0.855" becomes 855/1000). Reading the
 * value as the decimal the caller wrote is what makes half-up rounding behave
 * as expected instead of following the binary representation of the double.
 */
function decimalFraction(value: number, label: string): { numerator: bigint; denominator: bigint } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${String(value)}`);
  }

  const text = value.toString();
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(text);
  if (!match) {
    throw new RangeError(`${label} ${text} is outside the supported numeric range`);
  }

  const [, sign, integerPart, fractionPart = "", exponentPart] = match;
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart);
  let digits = integerPart + fractionPart;
  let scale = fractionPart.length - exponent;

  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }

  if (scale > 400) {
    throw new RangeError(`${label} ${text} has too many decimal places to convert exactly`);
  }

  return {
    numerator: BigInt(`${sign}${digits}`),
    denominator: BigInt(`1${"0".repeat(scale)}`),
  };
}

/**
 * Converts a euro amount such as `19.99` into euro cents.
 *
 * @throws RangeError for negative values, NaN, Infinity, unsafe magnitudes, or
 * amounts with more than two decimal places.
 */
export function eurosToCents(euros: number): number {
  if (typeof euros !== "number" || Number.isNaN(euros)) {
    throw new RangeError("euros must be a number, received NaN or a non-number");
  }
  if (!Number.isFinite(euros)) {
    throw new RangeError(`euros must be finite, received ${String(euros)}`);
  }
  if (euros < 0) {
    throw new RangeError(`euros must not be negative, received ${String(euros)}`);
  }

  const scaled = euros * CENTS_PER_EURO;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > noiseTolerance(scaled)) {
    throw new RangeError(`euros must have at most two decimal places, received ${String(euros)}`);
  }
  if (!Number.isSafeInteger(rounded)) {
    throw new RangeError(`euros is too large to represent in cents: ${String(euros)}`);
  }

  return rounded === 0 ? 0 : rounded;
}

/**
 * Converts euro cents into a euro amount for display, or for handing to an API
 * that expects a decimal. Negative values are allowed so credits and refunds
 * can be displayed without a separate code path.
 */
export function centsToEuros(cents: number): number {
  assertSafeInteger(cents, "cents");
  return cents === 0 ? 0 : cents / CENTS_PER_EURO;
}

/**
 * Converts euro cents to indicative pence at the supplied rate, rounding half
 * up to the nearest penny. The rate is applied as an exact fraction, so a rate
 * of 0.855 turns 100 cents (€1.00) into 86 pence, not 85.
 *
 * @throws RangeError when the rate is not a finite number greater than zero, or
 * when the result cannot be represented as a safe integer.
 */
export function convertEurCentsToGbpPence(cents: number, gbpPerEur: number): number {
  assertSafeInteger(cents, "cents");
  if (typeof gbpPerEur !== "number" || !Number.isFinite(gbpPerEur)) {
    throw new RangeError(`gbpPerEur must be a finite number, received ${String(gbpPerEur)}`);
  }
  if (gbpPerEur <= 0) {
    throw new RangeError(`gbpPerEur must be greater than zero, received ${String(gbpPerEur)}`);
  }

  const { numerator, denominator } = decimalFraction(gbpPerEur, "gbpPerEur");
  const magnitude = BigInt(Math.abs(cents));
  // floor((2n + d) / 2d) is half-up rounding for a non-negative fraction.
  const pence = (magnitude * numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
  const signed = cents < 0 ? -pence : pence;

  const result = Number(signed);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("the converted amount is too large to represent in pence");
  }
  return result === 0 ? 0 : result;
}

/** Formats euro cents as currency in the site locale, for example "€1,234.56". */
export function formatEur(cents: number): string {
  return euroFormatter.format(centsToEuros(cents));
}

/** Formats pence as currency in the site locale, for example "£1,234.56". */
export function formatGbp(pence: number): string {
  assertSafeInteger(pence, "pence");
  return poundFormatter.format(pence === 0 ? 0 : pence / CENTS_PER_EURO);
}

/**
 * Sums a list of euro cent amounts. The addition is exact for any total that
 * fits in a safe integer; a total outside that range throws rather than losing
 * precision.
 */
export function sumCents(amounts: readonly number[]): number {
  if (!Array.isArray(amounts)) {
    throw new RangeError("amounts must be an array of euro cent values");
  }

  let total = BigInt(0);
  for (const amount of amounts) {
    assertSafeInteger(amount, "each amount");
    total += BigInt(amount);
  }

  const result = Number(total);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("the total is too large to represent as a safe integer");
  }
  return result === 0 ? 0 : result;
}

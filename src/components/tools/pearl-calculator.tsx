"use client";

import { useCallback, useId, useMemo, useState } from "react";
import {
  DIRECTION_LABEL,
  PEARL_DIRECTIONS,
  RATE_PROBLEM_MESSAGE,
  RATE_WARNING,
  ROUNDING_EXPLANATION,
  convertPearls,
  parsePearlCount,
  parseRateInput,
  type PearlDirection,
  type PearlRate,
} from "./pearl-logic";
import {
  AMOUNT_PROBLEM_MESSAGE,
  currencySymbol,
  formatMoney,
  parseAmountInput,
} from "./format";
import { formatWholeNumber } from "./numbers";
export interface PearlCalculatorProps {
  /**
   * The official page that explains the cashless system, where the rate will be
   * announced. Shown instead of any scraped figure.
   */
  readonly rateInformationUrl: string;
}

/**
 * The Pearl calculator.
 *
 * The reader supplies both the rate and the amount, because the 2027 rate is not
 * published. Nothing is pre-filled with a guessed rate: an empty rate field with
 * an explanation is the honest state, and the tool says so in the result area
 * rather than showing a figure built on an assumption.
 *
 * Only euros are supported. Pearls are a euro-denominated system, and Brasil's
 * cashless arrangement is not described in the data, so offering reais here
 * would invent a mechanism.
 */
export function PearlCalculator({ rateInformationUrl }: PearlCalculatorProps) {
  const [direction, setDirection] = useState<PearlDirection>("euros-to-pearls");
  const [rateText, setRateText] = useState("");
  const [amountText, setAmountText] = useState("");

  const fieldId = useId();
  const field = useCallback((name: string) => `${fieldId}-${name}`, [fieldId]);

  // The rate is a per-Pearl price, not a currency total, so it gets the rate
  // parser: one decimal mark, no grouping, and a precise complaint about a third
  // decimal place. The memo key is the whole number of cents, a primitive, so
  // the object identity stays stable for as long as the rate itself does.
  const rateResult = parseRateInput(rateText);
  const centsPerPearl = rateResult.ok ? rateResult.centsPerPearl : null;
  const rate: PearlRate | null = useMemo(
    () => (centsPerPearl === null ? null : { centsPerPearl }),
    [centsPerPearl],
  );

  /*
    The amount field means different things in each direction: money in euros, or
    a count of whole Pearls. Reading a Pearl count through the money parser
    would treat "10" as €10.00 and multiply the result by a hundred, so the two
    directions get their own parser.
  */
  const isMoneyInput = direction === "euros-to-pearls";
  const moneyAmount = parseAmountInput(amountText);
  const pearlCount = parsePearlCount(amountText);

  /*
    The value handed to the conversion is whatever the field means in this
    direction: minor currency units for money, a plain count for Pearls. Using
    one for both is what would turn "10 Pearls" into a thousand.
  */
  const amountValid = isMoneyInput ? moneyAmount.kind === "valid" : pearlCount !== null;
  const amountForConversion = isMoneyInput
    ? moneyAmount.kind === "valid"
      ? moneyAmount.minorUnits
      : 0
    : (pearlCount ?? 0);

  const result = useMemo(() => {
    if (rate === null || !amountValid) return null;
    return convertPearls(
      isMoneyInput ? "euros-to-pearls" : "pearls-to-euros",
      amountForConversion,
      rate,
    );
  }, [rate, amountValid, amountForConversion, isMoneyInput]);

  const rateError =
    rateText.trim() === "" || rate !== null
      ? null
      : RATE_PROBLEM_MESSAGE[rateResult.ok ? "not-positive" : rateResult.problem];

  const amountError = !isMoneyInput
    ? amountText.trim() !== "" && pearlCount === null
      ? "Enter a whole number of Pearls."
      : null
    : moneyAmount.kind === "invalid"
      ? AMOUNT_PROBLEM_MESSAGE[moneyAmount.problem]
      : null;

  const amountLabel = isMoneyInput ? "Money to convert" : "Pearls to convert";

  return (
    <div>
      <section className="tool-panel" aria-labelledby={field("form-heading")}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={field("form-heading")}>
            Convert at your own rate
          </h2>
          <p className="tool-panel__hint">
            Both fields are yours to fill. The rate is the euro value of one Pearl, and it is not
            published for 2027 yet.
          </p>
        </div>

        <div className="tool-fields">
          <div className="tool-field">
            <span className="tool-field__label" id={field("direction-label")}>
              Direction
            </span>
            <div className="tool-segmented" role="group" aria-labelledby={field("direction-label")}>
              {PEARL_DIRECTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="tool-segmented__option"
                  aria-pressed={direction === option}
                  onClick={() => setDirection(option)}
                >
                  {direction === option ? (
                    <span className="tool-segmented__tick" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {DIRECTION_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("rate")}>
              Euro value of one Pearl <span className="tool-field__required">Required</span>
            </label>
            <div className="tool-field__row">
              <span className="tool-field__prefix" aria-hidden="true">
                {currencySymbol("EUR")}
              </span>
              <input
                id={field("rate")}
                className="tool-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="1.90"
                value={rateText}
                aria-invalid={rateError === null ? undefined : true}
                aria-describedby={rateError === null ? field("rate-note") : field("rate-error")}
                onChange={(event) => setRateText(event.target.value)}
              />
            </div>
            {rateError === null ? (
              <p className="tool-field__note" id={field("rate-note")}>
                The festival sets this figure and publishes it with the cashless information.{" "}
                <a href={rateInformationUrl} target="_blank" rel="noopener noreferrer">
                  Check the official cashless page
                </a>{" "}
                for the current value.
              </p>
            ) : (
              <p className="tool-field__error" id={field("rate-error")}>
                {rateError}
              </p>
            )}
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("amount")}>
              {amountLabel} <span className="tool-field__required">Required</span>
            </label>
            <div className="tool-field__row">
              <span className="tool-field__prefix" aria-hidden="true">
                {isMoneyInput ? currencySymbol("EUR") : "P"}
              </span>
              <input
                id={field("amount")}
                className="tool-input"
                type="text"
                inputMode={isMoneyInput ? "decimal" : "numeric"}
                autoComplete="off"
                placeholder={isMoneyInput ? "20.00" : "10"}
                value={amountText}
                aria-invalid={amountError === null ? undefined : true}
                aria-describedby={amountError === null ? undefined : field("amount-error")}
                onChange={(event) => setAmountText(event.target.value)}
              />
            </div>
            {amountError === null ? null : (
              <p className="tool-field__error" id={field("amount-error")}>
                {amountError}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="tool-panel" aria-labelledby={field("result-heading")}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={field("result-heading")}>
            Result
          </h2>
        </div>

        {/*
          The announcement is scoped to the figure rather than made by a live
          region on the whole panel. A live region on the panel re-read the
          static "No 2027 rate has been announced" warning on every keystroke as
          the reader typed a rate, which buried the one number they were waiting
          for. This region speaks the result alone, and stays empty until there
          is a result to speak.
        */}
        <p className="tool-announcer" role="status" aria-live="polite" aria-atomic="true">
          {result === null
            ? ""
            : isMoneyInput
              ? `${formatWholeNumber(result.pearls)} Pearls for ${formatMoney(
                  amountForConversion,
                  "EUR",
                )}${result.hasRemainder ? `, with ${formatMoney(result.remainderMinor, "EUR")} left over` : ""}.`
              : `${formatMoney(result.amountMinor, "EUR")} for ${formatWholeNumber(
                  amountForConversion,
                )} Pearls.`}
        </p>

        {result === null ? (
          <p className="tool-panel__hint">
            Fill in the rate and the amount to see a figure. Nothing is calculated until both fields
            hold usable numbers.
          </p>
        ) : (
          <div className="tool-result">
            <div className="tool-total">
              <p className="tool-total__label">
                {isMoneyInput ? "Whole Pearls" : "Cost"}
              </p>
              <p className="tool-total__figure">
                {isMoneyInput
                  ? `${formatWholeNumber(result.pearls)} Pearls`
                  : formatMoney(result.amountMinor, "EUR")}
              </p>
              {result.hasRemainder ? (
                <p className="tool-total__aside">
                  {formatMoney(result.remainderMinor, "EUR")} is left over and cannot buy another
                  Pearl.
                </p>
              ) : null}
            </div>

            <div>
              <div className="tool-note tool-note--info">
                <span className="tool-note__label">How the rounding works</span>
                <p>{ROUNDING_EXPLANATION}</p>
              </div>
            </div>
          </div>
        )}

        <div className="tool-note tool-note--warning">
          <span className="tool-note__label">No 2027 rate has been announced</span>
          <p>{RATE_WARNING}</p>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  WINTER_OFFICIAL_LINKS,
  WINTER_TIMER_DISCLAIMER,
  WINTER_ZONES,
  type WinterCrowdLevel,
  type WinterTravelMode,
} from "./winter-timer-data";
import { calculateWinterRoute } from "./winter-timer-logic";
import "./winter-timer.css";

export interface WinterTimerToolProps {
  readonly initialFromId?: string;
  readonly initialToId?: string;
}

const CROWD_OPTIONS: readonly { readonly id: WinterCrowdLevel; readonly label: string }[] = [
  { id: "light", label: "Light / mid-day" },
  { id: "standard", label: "Standard flow" },
  { id: "peak", label: "Peak changeover / snow" },
];

export function WinterTimerTool({
  initialFromId = "frozen-lotus-2027",
  initialToId = "mainstage-2027",
}: WinterTimerToolProps) {
  const [fromId, setFromId] = useState(initialFromId);
  const [toId, setToId] = useState(initialToId);
  const [mode, setMode] = useState<WinterTravelMode>("ski");
  const [crowdLevel, setCrowdLevel] = useState<WinterCrowdLevel>("standard");
  const [setTime, setSetTime] = useState("19:30");
  const [bufferMinutes, setBufferMinutes] = useState(10);

  const result = useMemo(
    () =>
      calculateWinterRoute({
        fromId,
        toId,
        mode,
        crowdLevel,
        setTime,
        bufferMinutes,
      }),
    [fromId, toId, mode, crowdLevel, setTime, bufferMinutes],
  );

  function handleSwap() {
    setFromId(toId);
    setToId(fromId);
  }

  const barTotal = result && result.totalMinutesWithBuffer > 0 ? result.totalMinutesWithBuffer : 1;

  return (
    <div className="tml-wtimer">
      <div className="tml-wtimer-disclaimer" role="note" aria-label="Planning estimate notice">
        <span className="tml-wtimer-disclaimer__label">Alpine planning estimate</span>
        <p>{WINTER_TIMER_DISCLAIMER}</p>
      </div>

      <section className="tool-panel" aria-labelledby="tml-wtimer-form-heading">
        <div className="tool-panel__head">
          <p className="label text-accent">Alpe d&apos;Huez transit</p>
          <h2 id="tml-wtimer-form-heading" className="tool-panel__title">
            Plan your stage-to-stage transfer
          </h2>
          <p className="tool-panel__hint">
            Choose where you are starting, which stage or resort hub you need to reach, and how you
            are travelling across Alpe d&apos;Huez.
          </p>
        </div>

        <div className="tml-wtimer-route-row">
          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-wtimer-from">
              Starting stage or hub
            </label>
            <CustomSelect
              id="tml-wtimer-from"
              ariaLabel="Starting stage or hub"
              value={fromId}
              onChange={setFromId}
              options={WINTER_ZONES.map((zone) => ({ value: zone.id, label: zone.name }))}
            />
          </div>

          <button
            type="button"
            className="tool-btn tml-wtimer-swap"
            onClick={handleSwap}
            aria-label="Swap starting stage and target stage"
          >
            Swap ⇄
          </button>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-wtimer-to">
              Target stage or hub
            </label>
            <CustomSelect
              id="tml-wtimer-to"
              ariaLabel="Target stage or hub"
              value={toId}
              onChange={setToId}
              options={WINTER_ZONES.map((zone) => ({ value: zone.id, label: zone.name }))}
            />
          </div>
        </div>

        <div className="tml-wtimer-options">
          <div className="tool-field">
            <span className="tool-field__label" id="tml-wtimer-mode-label">
              Travel mode
            </span>
            <div
              className="tool-segmented"
              role="group"
              aria-labelledby="tml-wtimer-mode-label"
            >
              <button
                type="button"
                className="tool-segmented__option"
                aria-pressed={mode === "ski"}
                onClick={() => setMode("ski")}
              >
                {mode === "ski" ? (
                  <span className="tool-segmented__tick" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                Ski / Snowboard
              </button>
              <button
                type="button"
                className="tool-segmented__option"
                aria-pressed={mode === "pedestrian"}
                onClick={() => setMode("pedestrian")}
              >
                {mode === "pedestrian" ? (
                  <span className="tool-segmented__tick" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                Pedestrian / Gondola
              </button>
            </div>
          </div>

          <div className="tool-field">
            <span className="tool-field__label" id="tml-wtimer-crowd-label">
              Queue &amp; weather conditions
            </span>
            <div
              className="tool-segmented"
              role="group"
              aria-labelledby="tml-wtimer-crowd-label"
            >
              {CROWD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="tool-segmented__option"
                  aria-pressed={crowdLevel === option.id}
                  onClick={() => setCrowdLevel(option.id)}
                >
                  {crowdLevel === option.id ? (
                    <span className="tool-segmented__tick" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tml-wtimer-timing-row">
          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-wtimer-set-time">
              Target set time (optional, 24h)
            </label>
            <input
              id="tml-wtimer-set-time"
              type="time"
              className="tool-input"
              value={setTime}
              onChange={(event) => setSetTime(event.target.value)}
            />
            <p className="tool-field__note">
              Leave blank to see total transit time only, or enter a set time to calculate when to
              depart.
            </p>
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-wtimer-buffer">
              Arrival buffer (minutes)
            </label>
            <CustomSelect
              id="tml-wtimer-buffer"
              ariaLabel="Arrival buffer (minutes)"
              value={String(bufferMinutes)}
              onChange={(next) => setBufferMinutes(Number(next))}
              options={[0, 5, 10, 15, 20, 30, 45].map((mins) => ({
                value: String(mins),
                label: mins === 0 ? "No extra buffer (0 min)" : `${mins} minutes before set`,
              }))}
            />
            <p className="tool-field__note">
              Time for lockers, boot changes, toilets, or finding your spot before the set starts.
            </p>
          </div>
        </div>
      </section>

      {result ? (
        <section
          className="tool-panel"
          aria-labelledby="tml-wtimer-result-heading"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="tool-panel__head">
            <p className="label text-accent">Estimated transfer</p>
            <h3 id="tml-wtimer-result-heading" className="tool-panel__title">
              {result.from.name} to {result.to.name}
            </h3>
            <p className="tool-panel__hint">
              Mode: {result.mode === "ski" ? "Ski / Snowboard" : "Pedestrian / Gondola"} ·
              Approximate distance: {result.formattedDistance}
            </p>
          </div>

          <div className="tml-wtimer-hero">
            <div className="tml-wtimer-card tml-wtimer-card--accent">
              <p className="tml-wtimer-card__label">
                {result.leaveByTime ? "Recommended leave-by time" : "Total transit estimate"}
              </p>
              <span className="tml-wtimer-card__figure">
                {result.leaveByTime ?? `${result.transitMinutes} min`}
              </span>
              <p className="tml-wtimer-card__sub">
                {result.leaveByTime && result.targetSetTime
                  ? `Leave by ${result.leaveByTime} to reach ${result.to.name} ${result.arrivalBufferMinutes} min before a ${result.targetSetTime} set (${result.totalMinutesWithBuffer} min total).`
                  : `Estimated door-to-stage transit time (${result.transitMinutes} min) plus ${result.arrivalBufferMinutes} min arrival buffer.`}
              </p>
            </div>

            <div className="tml-wtimer-card">
              <p className="tml-wtimer-card__label">Transit time (before arrival buffer)</p>
              <span className="tml-wtimer-card__figure">{result.transitMinutes} min</span>
              <p className="tml-wtimer-card__sub">
                {result.isSameZone
                  ? "Start and target are the same stage or hub."
                  : `Across ${result.steps.length} ${result.steps.length === 1 ? "leg" : "legs"} (${result.formattedDistance}).`}
              </p>
            </div>
          </div>

          {!result.isSameZone ? (
            <div className="tml-wtimer-bar-wrap">
              <div className="tml-wtimer-bar" aria-hidden="true">
                {result.walkOrSkiMinutes > 0 ? (
                  <div
                    className="tml-wtimer-bar__seg--walk"
                    style={{ width: `${(result.walkOrSkiMinutes / barTotal) * 100}%` }}
                  />
                ) : null}
                {result.liftMinutes > 0 ? (
                  <div
                    className="tml-wtimer-bar__seg--lift"
                    style={{ width: `${(result.liftMinutes / barTotal) * 100}%` }}
                  />
                ) : null}
                {result.queueMinutes > 0 ? (
                  <div
                    className="tml-wtimer-bar__seg--queue"
                    style={{ width: `${(result.queueMinutes / barTotal) * 100}%` }}
                  />
                ) : null}
                {result.arrivalBufferMinutes > 0 ? (
                  <div
                    className="tml-wtimer-bar__seg--buffer"
                    style={{ width: `${(result.arrivalBufferMinutes / barTotal) * 100}%` }}
                  />
                ) : null}
              </div>

              <div className="tml-wtimer-breakdown">
                <div className="tml-wtimer-metric">
                  <span className="tml-wtimer-metric__head">
                    <span className="tml-wtimer-swatch tml-wtimer-swatch--walk" />
                    {result.mode === "ski" ? "Walk / ski" : "Walk"}
                  </span>
                  <span className="tml-wtimer-metric__val">{result.walkOrSkiMinutes} min</span>
                </div>

                <div className="tml-wtimer-metric">
                  <span className="tml-wtimer-metric__head">
                    <span className="tml-wtimer-swatch tml-wtimer-swatch--lift" />
                    Lift / gondola
                  </span>
                  <span className="tml-wtimer-metric__val">{result.liftMinutes} min</span>
                </div>

                <div className="tml-wtimer-metric">
                  <span className="tml-wtimer-metric__head">
                    <span className="tml-wtimer-swatch tml-wtimer-swatch--queue" />
                    Queue buffer
                  </span>
                  <span className="tml-wtimer-metric__val">{result.queueMinutes} min</span>
                </div>

                <div className="tml-wtimer-metric">
                  <span className="tml-wtimer-metric__head">
                    <span className="tml-wtimer-swatch tml-wtimer-swatch--buffer" />
                    Arrival buffer
                  </span>
                  <span className="tml-wtimer-metric__val">{result.arrivalBufferMinutes} min</span>
                </div>
              </div>

              <ol className="tml-wtimer-steps" aria-label="Route leg breakdown">
                {result.steps.map((step, index) => (
                  <li key={`${step.fromName}-${step.toName}-${index}`} className="tml-wtimer-step">
                    <p className="tml-wtimer-step__title">
                      {index + 1}. {step.fromName} → {step.toName}
                    </p>
                    <p className="tml-wtimer-step__meta">{step.connectionLabel}</p>
                    <div className="tml-wtimer-step__pills">
                      <span className="tml-wtimer-pill">
                        {result.mode === "ski" ? "Walk/ski" : "Walk"}: {step.walkOrSkiMinutes} min
                      </span>
                      <span className="tml-wtimer-pill">Lift: {step.liftMinutes} min</span>
                      <span className="tml-wtimer-pill">Queue: {step.queueMinutes} min</span>
                      <span className="tml-wtimer-pill">
                        ~{step.distanceMiles} {step.distanceMiles === 1 ? "mile" : "miles"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.advisories.length > 0 ? (
            <div className="tool-note tool-note--warning">
              <span className="tool-note__label">Verified Winter 2027 notes</span>
              {result.advisories.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}

          <div className="tool-note tool-note--info">
            <span className="tool-note__label">Live lift status &amp; official advice</span>
            <p>
              Alpine winds, fresh snowfall, and lift holds can add 20–40 minutes or close upper
              lifts at short notice. Always check live Alpe d&apos;Huez lift status and official
              Tomorrowland Winter practical pages before leaving.
            </p>
            <div className="tml-wtimer-links">
              {WINTER_OFFICIAL_LINKS.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tool-btn"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

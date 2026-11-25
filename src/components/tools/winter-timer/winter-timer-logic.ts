import {
  WINTER_ROUTE_LEGS,
  WINTER_ZONES,
  type WinterCrowdLevel,
  type WinterRouteLeg,
  type WinterTravelMode,
  type WinterZone,
} from "./winter-timer-data";
import { formatMiles } from "../maps/maps-logic";

export interface WinterTimerInput {
  readonly fromId: string;
  readonly toId: string;
  readonly mode: WinterTravelMode;
  readonly crowdLevel: WinterCrowdLevel;
  /** Optional 24-hour "HH:MM" target set time. Empty string or undefined disables leave-by calculation. */
  readonly setTime?: string;
  /** Extra arrival buffer in minutes (0–60). */
  readonly bufferMinutes: number;
}

export interface WinterTransitStep {
  readonly fromName: string;
  readonly toName: string;
  readonly connectionLabel: string;
  readonly walkOrSkiMinutes: number;
  readonly liftMinutes: number;
  readonly queueMinutes: number;
  readonly distanceMiles: number;
}

export interface WinterTimerResult {
  readonly from: WinterZone;
  readonly to: WinterZone;
  readonly isSameZone: boolean;
  readonly mode: WinterTravelMode;
  readonly crowdLevel: WinterCrowdLevel;
  readonly walkOrSkiMinutes: number;
  readonly liftMinutes: number;
  readonly queueMinutes: number;
  /** Transit time excluding the optional arrival buffer. */
  readonly transitMinutes: number;
  /** Clamped arrival buffer in minutes. */
  readonly arrivalBufferMinutes: number;
  /** Transit time plus arrival buffer. */
  readonly totalMinutesWithBuffer: number;
  /** Approximate distance in miles. */
  readonly distanceMiles: number;
  readonly formattedDistance: string;
  /** Formatted "HH:MM" leave-by time when a valid `setTime` is supplied, else null. */
  readonly leaveByTime: string | null;
  readonly targetSetTime: string | null;
  readonly steps: readonly WinterTransitStep[];
  readonly advisories: readonly string[];
}

const CROWD_QUEUE_MULTIPLIER: Readonly<Record<WinterCrowdLevel, number>> = {
  light: 0.75,
  standard: 1,
  peak: 1.65,
};

/** Parses a 24-hour "HH:MM" clock string into minutes since midnight, or null if invalid. */
export function parseClockMinutes(clock: string | undefined): number | null {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Formats minutes since midnight into "HH:MM", wrapping cleanly across midnight. */
export function formatClockMinutes(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function legCost(leg: WinterRouteLeg, mode: WinterTravelMode, crowdLevel: WinterCrowdLevel) {
  const profile = leg[mode];
  const queueMinutes = Math.round(profile.baseQueueMinutes * CROWD_QUEUE_MULTIPLIER[crowdLevel]);
  const total = profile.walkOrSkiMinutes + profile.liftMinutes + queueMinutes;
  return {
    walkOrSkiMinutes: profile.walkOrSkiMinutes,
    liftMinutes: profile.liftMinutes,
    queueMinutes,
    total,
  };
}

function buildAdvisories(
  from: WinterZone,
  to: WinterZone,
  mode: WinterTravelMode,
  targetMinutes: number | null,
): string[] {
  const notes: string[] = [];

  if (from.id === "oz-3300" || to.id === "oz-3300") {
    notes.push(
      "Oz 3300 last daytime lift is 16:45. Evening access uses the Oz 3300 night lift (~20 min, €40 Transportation Pass or included with Oz 3300 packages) between 18:30–21:00 and 22:30–00:30 (until 02:00 on MainStage days). Walking between Alpe d'Huez and surrounding villages is prohibited.",
    );
  }

  if (to.id === "mainstage-2027") {
    notes.push(
      "The covered and heated MainStage is open Tuesday 23 to Friday 26 March 2027 only (closed Saturday 20 to Monday 22 March). Last admission to the main festival area is 00:30 Tue–Fri.",
    );
  } else if (to.group === "village") {
    notes.push(
      "Main festival area hours are 19:00–00:00 Sat–Mon (last admission 23:30) and 19:00–01:30 Tue–Fri (last admission 00:30).",
    );
  }

  if (to.group === "mountain") {
    notes.push(
      "Mountain stages run 12:00–17:00 Sat–Mon and 12:00–17:30 Tue–Fri. Only the lifts from the mountain stages down to Alpe d'Huez stay open until stage closing.",
    );
    if (targetMinutes !== null && (targetMinutes >= 17 * 60 + 30 || targetMinutes < 11 * 60)) {
      notes.push(
        "Your target set time falls outside published mountain-stage daytime hours (12:00–17:00 Sat–Mon; 12:00–17:30 Tue–Fri). Double-check the stage timetable.",
      );
    }
  }

  if (mode === "pedestrian" && (from.group === "mountain" || to.group === "mountain")) {
    notes.push(
      "All mountain stages are accessible to pedestrians with the lift and ski pass included in every Tomorrowland Winter ticket. Wear warm, grippy winter boots for snow-packed paths.",
    );
  }

  if (mode === "ski" && to.group === "village") {
    notes.push(
      "Allow extra time to drop skis or snowboards at your accommodation or a locker before entering the village main festival area.",
    );
  }

  return notes;
}

/**
 * Calculates the shortest estimated Winter transit route between two stages or resort hubs
 * using Dijkstra's algorithm on the directed resort/lift graph.
 */
export function calculateWinterRoute(input: WinterTimerInput): WinterTimerResult | null {
  const zoneById = new Map(WINTER_ZONES.map((z) => [z.id, z]));
  const from = zoneById.get(input.fromId);
  const to = zoneById.get(input.toId);
  if (!from || !to) return null;

  const arrivalBufferMinutes = Math.max(0, Math.min(60, Math.round(input.bufferMinutes || 0)));
  const targetMinutes = parseClockMinutes(input.setTime);
  const targetSetTime = targetMinutes !== null ? formatClockMinutes(targetMinutes) : null;

  if (from.id === to.id) {
    const totalMinutesWithBuffer = arrivalBufferMinutes;
    return {
      from,
      to,
      isSameZone: true,
      mode: input.mode,
      crowdLevel: input.crowdLevel,
      walkOrSkiMinutes: 0,
      liftMinutes: 0,
      queueMinutes: 0,
      transitMinutes: 0,
      arrivalBufferMinutes,
      totalMinutesWithBuffer,
      distanceMiles: 0,
      formattedDistance: formatMiles(0),
      leaveByTime:
        targetMinutes !== null ? formatClockMinutes(targetMinutes - totalMinutesWithBuffer) : null,
      targetSetTime,
      steps: [],
      advisories: buildAdvisories(from, to, input.mode, targetMinutes),
    };
  }

  const outgoing = new Map<string, WinterRouteLeg[]>();
  for (const zone of WINTER_ZONES) {
    outgoing.set(zone.id, []);
  }
  for (const leg of WINTER_ROUTE_LEGS) {
    outgoing.get(leg.from)?.push(leg);
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { nodeId: string; leg: WinterRouteLeg }>();
  const unvisited = new Set<string>(WINTER_ZONES.map((z) => z.id));

  for (const zone of WINTER_ZONES) {
    dist.set(zone.id, Number.POSITIVE_INFINITY);
  }
  dist.set(from.id, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const candidate of unvisited) {
      const candidateCost = dist.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (candidateCost < bestCost) {
        bestCost = candidateCost;
        currentId = candidate;
      }
    }

    if (currentId === null || !Number.isFinite(bestCost)) break;
    unvisited.delete(currentId);
    if (currentId === to.id) break;

    for (const leg of outgoing.get(currentId) ?? []) {
      if (!unvisited.has(leg.to)) continue;
      const cost = legCost(leg, input.mode, input.crowdLevel).total;
      const alt = bestCost + cost;
      if (alt < (dist.get(leg.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(leg.to, alt);
        prev.set(leg.to, { nodeId: currentId, leg });
      }
    }
  }

  if (!prev.has(to.id)) return null;

  const legs: WinterRouteLeg[] = [];
  let cursor = to.id;
  while (cursor !== from.id) {
    const step = prev.get(cursor);
    if (!step) return null;
    legs.push(step.leg);
    cursor = step.nodeId;
  }
  legs.reverse();

  let walkOrSkiMinutes = 0;
  let liftMinutes = 0;
  let queueMinutes = 0;
  let distanceMiles = 0;

  const steps: WinterTransitStep[] = legs.map((leg) => {
    const cost = legCost(leg, input.mode, input.crowdLevel);
    walkOrSkiMinutes += cost.walkOrSkiMinutes;
    liftMinutes += cost.liftMinutes;
    queueMinutes += cost.queueMinutes;
    distanceMiles += leg.distanceMiles;

    return {
      fromName: zoneById.get(leg.from)?.name ?? leg.from,
      toName: zoneById.get(leg.to)?.name ?? leg.to,
      connectionLabel: leg.connectionLabel,
      walkOrSkiMinutes: cost.walkOrSkiMinutes,
      liftMinutes: cost.liftMinutes,
      queueMinutes: cost.queueMinutes,
      distanceMiles: Math.round(leg.distanceMiles * 100) / 100,
    };
  });

  const roundedMiles = Math.round(distanceMiles * 100) / 100;
  const transitMinutes = walkOrSkiMinutes + liftMinutes + queueMinutes;
  const totalMinutesWithBuffer = transitMinutes + arrivalBufferMinutes;

  return {
    from,
    to,
    isSameZone: false,
    mode: input.mode,
    crowdLevel: input.crowdLevel,
    walkOrSkiMinutes,
    liftMinutes,
    queueMinutes,
    transitMinutes,
    arrivalBufferMinutes,
    totalMinutesWithBuffer,
    distanceMiles: roundedMiles,
    formattedDistance: formatMiles(roundedMiles),
    leaveByTime:
      targetMinutes !== null ? formatClockMinutes(targetMinutes - totalMinutesWithBuffer) : null,
    targetSetTime,
    steps,
    advisories: buildAdvisories(from, to, input.mode, targetMinutes),
  };
}

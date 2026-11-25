import { describe, expect, it } from "vitest";
import { WINTER_ZONES } from "./winter-timer-data";
import {
  calculateWinterRoute,
  formatClockMinutes,
  parseClockMinutes,
} from "./winter-timer-logic";

describe("clock helpers", () => {
  it("parses valid 24-hour times and rejects invalid inputs", () => {
    expect(parseClockMinutes("00:00")).toBe(0);
    expect(parseClockMinutes("15:30")).toBe(15 * 60 + 30);
    expect(parseClockMinutes("23:59")).toBe(23 * 60 + 59);
    expect(parseClockMinutes("24:00")).toBeNull();
    expect(parseClockMinutes("invalid")).toBeNull();
    expect(parseClockMinutes("")).toBeNull();
  });

  it("formats minutes and wraps cleanly across midnight", () => {
    expect(formatClockMinutes(0)).toBe("00:00");
    expect(formatClockMinutes(19 * 60 + 30)).toBe("19:30");
    expect(formatClockMinutes(-30)).toBe("23:30");
    expect(formatClockMinutes(1440 + 45)).toBe("00:45");
  });
});

describe("calculateWinterRoute", () => {
  it("calculates downhill ski transfer faster than pedestrian gondola from Frozen Lotus to MainStage", () => {
    const skiResult = calculateWinterRoute({
      fromId: "frozen-lotus-2027",
      toId: "mainstage-2027",
      mode: "ski",
      crowdLevel: "standard",
      setTime: "19:30",
      bufferMinutes: 10,
    });

    const pedResult = calculateWinterRoute({
      fromId: "frozen-lotus-2027",
      toId: "mainstage-2027",
      mode: "pedestrian",
      crowdLevel: "standard",
      setTime: "19:30",
      bufferMinutes: 10,
    });

    expect(skiResult).not.toBeNull();
    expect(pedResult).not.toBeNull();
    expect(skiResult!.liftMinutes).toBe(0);
    expect(pedResult!.liftMinutes).toBeGreaterThan(0);
    expect(skiResult!.transitMinutes).toBeLessThan(pedResult!.transitMinutes);
    expect(skiResult!.formattedDistance).toMatch(/miles/);
    expect(skiResult!.leaveByTime).not.toBeNull();
  });

  it("increases queue buffer under peak crowd conditions", () => {
    const light = calculateWinterRoute({
      fromId: "alpe-village-centre",
      toId: "frozen-lotus-2027",
      mode: "pedestrian",
      crowdLevel: "light",
      bufferMinutes: 5,
    });
    const peak = calculateWinterRoute({
      fromId: "alpe-village-centre",
      toId: "frozen-lotus-2027",
      mode: "pedestrian",
      crowdLevel: "peak",
      bufferMinutes: 5,
    });

    expect(peak!.queueMinutes).toBeGreaterThan(light!.queueMinutes);
    expect(peak!.transitMinutes).toBeGreaterThan(light!.transitMinutes);
  });

  it("wraps leave-by time past midnight for late village sets", () => {
    const result = calculateWinterRoute({
      fromId: "oz-3300",
      toId: "cage-2027",
      mode: "pedestrian",
      crowdLevel: "standard",
      setTime: "00:15",
      bufferMinutes: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.leaveByTime).toMatch(/^23:\d{2}$/);
    expect(result!.advisories.some((note) => note.includes("Oz 3300"))).toBe(true);
  });

  it("warns when a mountain stage target set time is outside daytime hours", () => {
    const result = calculateWinterRoute({
      fromId: "alpe-village-centre",
      toId: "orbyz-2027",
      mode: "ski",
      crowdLevel: "standard",
      setTime: "18:30",
      bufferMinutes: 10,
    });

    expect(
      result?.advisories.some((note) => note.includes("outside published mountain-stage daytime hours")),
    ).toBe(true);
  });

  it("handles same-zone selection and invalid zone IDs", () => {
    const same = calculateWinterRoute({
      fromId: "cage-2027",
      toId: "cage-2027",
      mode: "pedestrian",
      crowdLevel: "standard",
      setTime: "21:00",
      bufferMinutes: 15,
    });
    expect(same?.isSameZone).toBe(true);
    expect(same?.transitMinutes).toBe(0);
    expect(same?.leaveByTime).toBe("20:45");

    expect(
      calculateWinterRoute({
        fromId: "nonexistent",
        toId: "cage-2027",
        mode: "ski",
        crowdLevel: "standard",
        bufferMinutes: 0,
      }),
    ).toBeNull();
  });

  it("connects every pair of Winter zones in both modes", () => {
    for (const from of WINTER_ZONES) {
      for (const to of WINTER_ZONES) {
        const ski = calculateWinterRoute({
          fromId: from.id,
          toId: to.id,
          mode: "ski",
          crowdLevel: "standard",
          bufferMinutes: 10,
        });
        const ped = calculateWinterRoute({
          fromId: from.id,
          toId: to.id,
          mode: "pedestrian",
          crowdLevel: "standard",
          bufferMinutes: 10,
        });
        expect(ski, `ski ${from.id} -> ${to.id}`).not.toBeNull();
        expect(ped, `ped ${from.id} -> ${to.id}`).not.toBeNull();
      }
    }
  });
});

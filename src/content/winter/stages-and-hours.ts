import type { GuideChapter } from "../schema";

/**
 * Winter chapter 5 of 8: stages and hours.
 *
 * The seven 2027 stage names come from the official line-up release and the
 * hours from the official opening-hours page. Both are ledger-confirmed, and
 * the stage roster is displayed through a `data` block so the names and
 * descriptions render from `src/data/winter/stages.ts`.
 *
 * Deliberately absent: lift routes for any stage except Frozen Lotus, queue
 * times, afterparty venues and any claim about a stage being indoor or heated
 * other than the MainStage, because no official page states them for 2027.
 */
const CHECKED = "2026-11-18";

const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const LINEUP_PRESS =
  "https://press.winter.tomorrowland.com/from-midday-to-mainstage-tomorrowland-winter-2027-reveals-its-full-line-up";
const AT_FESTIVAL = "https://winter.tomorrowland.com/en/practical/at-the-festival/";
const TICKET = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const FROZEN_LOTUS =
  "https://winter.tomorrowland.com/en/add-on-sale/food-experiences/frozen-lotus/";
const TRANSPORT_PASS =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";

export const winterStagesAndHoursChapter = {
  edition: "winter",
  slug: "stages-and-hours",
  order: 5,
  title: "Stages and hours",
  summary:
    "The seven 2027 stages, the mountain and village hours, the MainStage's midweek opening and the lift rules that decide when you have to leave the mountain.",
  lastVerified: CHECKED,
  related: [
    "winter/overview",
    "winter/transport",
    "winter/tickets-and-packages",
    "general/sets",
  ],
  sources: [
    { id: "s1", title: "Tomorrowland Winter: opening hours", url: HOURS, checkedOn: CHECKED },
    {
      id: "s2",
      title: "From midday to MainStage: Tomorrowland Winter 2027 reveals its full line-up",
      url: LINEUP_PRESS,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter: at the festival",
      url: AT_FESTIVAL,
      checkedOn: CHECKED,
    },
    {
      id: "s4",
      title: "Tomorrowland Winter: festival ticket",
      url: TICKET,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter: Frozen Lotus food experience",
      url: FROZEN_LOTUS,
      checkedOn: CHECKED,
    },
    {
      id: "s6",
      title: "Tomorrowland Winter: Transportation Pass",
      url: TRANSPORT_PASS,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "the-stages", text: "The 2027 stages" },
    {
      type: "p",
      text: "The 2027 line-up names seven stages. Three carry the daytime programme on the mountain, three run at night in the village, and Moose Bar runs a daytime slot of its own.",
      sources: ["s2", "s1"],
    },
    {
      /* The roster is a record set, not prose: the names, kinds and official
         descriptions come from `src/data/winter/stages.ts`, and its own source
         link and check date render under the table. */
      type: "data",
      edition: "winter",
      collection: "stages",
      caption: "The seven stages named for Winter 2027, as the official pages describe them",
    },
    {
      type: "p",
      text: "The roster changes between editions, so a route note written for an earlier year can point at a stage that no longer exists. Check the stage list above against the resort map at the lift rather than trusting a guide from a previous winter.",
      sources: ["s2", "s1"],
    },
    {
      type: "p",
      text: "Only the MainStage is officially described in structural terms, as covered and heated. The official release does not say whether the other stages are indoor, heated or open-air, so treat the evening as an outdoor evening and dress for the walk between stages.",
      sources: ["s3", "s2"],
    },
    { type: "h2", id: "mountain-hours", text: "Mountain stage hours" },
    {
      type: "p",
      text: "The mountain stages open at midday and close in the late afternoon. They run to 17:00 from Saturday to Monday and to 17:30 from Tuesday to Friday, so the main festival days give you an extra half hour above the village.",
      sources: ["s1"],
    },
    {
      type: "facts",
      caption: "Winter 2027 opening hours",
      rows: [
        {
          label: "Mountain stages, Saturday to Monday",
          value: "12:00–17:00",
          sources: ["s1"],
        },
        {
          label: "Mountain stages, Tuesday to Friday",
          value: "12:00–17:30",
          sources: ["s1"],
        },
        {
          label: "Main festival area, Saturday to Monday",
          value: "19:00–00:00",
          sources: ["s1"],
        },
        {
          label: "Main festival area, Tuesday to Friday",
          value: "19:00–01:30",
          sources: ["s1"],
        },
        {
          label: "Last admission, Saturday to Monday",
          value: "23:30",
          sources: ["s1"],
        },
        {
          label: "Last admission, Tuesday to Friday",
          value: "00:30",
          sources: ["s1"],
        },
        {
          label: "Moosebar by Day",
          value: "15:00–19:30, Saturday to Friday",
          sources: ["s1"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Last admission is not closing time",
      text: "The main area closes at 00:00 or 01:30, but entry stops at 23:30 or 00:30. Arriving after that time means being turned away whatever your ticket says, so a late dinner in the village can cost you the night.",
      sources: ["s1"],
    },
    { type: "h2", id: "mainstage", text: "The MainStage" },
    {
      type: "p",
      text: "The MainStage opens on Tuesday 23 March and closes after Friday 26 March. It is shut for the whole of the pre-days, Saturday 20 to Monday 22 March, even though the main festival area opens each evening and the mountain stages run each day.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "It is the only covered and heated stage the official pages describe, which is why it carries the longest evening hours and the last admission at 00:30 on the main days.",
      sources: ["s3", "s1"],
    },
    { type: "h2", id: "moosebar", text: "Moosebar by Day" },
    {
      type: "p",
      text: "Moosebar by Day runs from 15:00 to 19:30, Saturday to Friday, so it starts while the mountain stages are still open and finishes as the main area opens. It bridges the two halves of the day.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The 2027 opening-hours page publishes no night-time Moosebar slot. If a night session is running, it is not on the official page this guide checked, so plan around the daytime slot rather than a night one.",
      sources: ["s1"],
    },
    { type: "h2", id: "reaching-stages", text: "Reaching the mountain stages" },
    {
      type: "p",
      text: "All mountain stages can be reached by pedestrians, and the lift and ski pass that every ticket includes is how you get up and down. You do not need to ski to attend a mountain stage.",
      sources: ["s3", "s4"],
    },
    {
      type: "p",
      text: "Frozen Lotus is reached by the Les Marmottes 1 lift from Bergers, up to the Marmottes 2300 station. That is the only 2027 stage route the official pages state, so for the others check the resort map at the lift rather than relying on a route from an earlier edition.",
      sources: ["s5"],
    },
    {
      type: "p",
      text: "Only the lifts from the mountain stages back down to Alpe d'Huez keep running until the stages close. Everything else on the mountain has a fixed last departure.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "The way down is not the way out of the resort",
      text: "The lifts will bring you from a mountain stage back to Alpe d'Huez after the last set. They will not take you on to a surrounding village: those connections stop between 16:30 and 17:50. A village bed needs the Transportation Pass for the evening.",
      sources: ["s1", "s6"],
    },
    { type: "h2", id: "planning-a-day", text: "Planning a day" },
    {
      type: "ol",
      items: [
        "Check which stage you want first, because the three daytime stages are on the mountain and the evening stages are in the village, and the day is split between them.",
        "Be on the mountain by early afternoon. The stages open at 12:00, and the last lift down from a stage to Alpe d'Huez is tied to the 17:00 or 17:30 close.",
        "Use the 15:00 to 19:30 Moosebar by Day slot as the move from the mountain to the village, rather than travelling twice.",
        "Be at the main area gate before 23:30, or before 00:30 on Tuesday to Friday. After that, admission stops.",
        "If you are staying outside Alpe d'Huez, check the village lift last departure before you commit to a late afternoon set, and hold the Transportation Pass for the way back.",
      ],
      sources: ["s1", "s3", "s6"],
    },
    {
      type: "p",
      text: "The single biggest planning error is treating the week as one shape. Saturday to Monday has a mountain programme and an evening village programme with no MainStage; Tuesday to Friday adds the MainStage and an extra half hour on the mountain.",
      sources: ["s1"],
    },
  ],
} satisfies GuideChapter;

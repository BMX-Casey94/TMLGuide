import type { GuideChapter } from "../schema";

/**
 * Winter chapter 4 of 8: transport.
 *
 * Everything here comes from a ledger row with a publishable verdict: the
 * package/transport matrix, the airport road times, the operator suspension
 * note for Geneva, the free resort bus network, the Transportation Pass, the
 * winter-equipment law and the parking tariff. Operator coach fares live in
 * `src/data/winter/shuttles.ts` and are shown through `data` blocks, so no fare
 * is retyped here; each row of those tables prints the operator's own notes
 * beside the price, which is how the Altibus suspension reaches the reader with
 * the figure rather than after it.
 */
const CHECKED = "2026-11-18";

const GET_THERE = "https://winter.tomorrowland.com/en/practical/how-to-get-there/";
const TRANSPORT_PACKAGES =
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/";
const TRANSPORT_PASS =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";
const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const TAXIS = "https://winter.tomorrowland.com/en/practical/how-to-get-there/shuttles-adh/";
const TRANSALTITUDE = "https://www.transaltitude.fr/fr/station/lalpe-dhuez/";
const TRANSALTITUDE_TIMETABLE = "https://www.transaltitude.fr/wp-content/uploads/2026/11/AH6.pdf";
const BENSBUS_AIRPORTS = "https://www.bensbus.co.uk/ski-transfer/alpe-dhuez-airport-transfers/";
const ALTIBUS = "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/";
const RHONEXPRESS = "https://www.rhonexpress.fr/en";
const PARKING = "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/parking/";
const RESORT_BUSES =
  "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/transports-urbains-gratuits/";
const TOWN_LIFTS = "https://www.alpedhuez.com/fr/votre-sejour/transports-sur-place/transports-vers-la-station/";
const TYRE_RULE = "https://www.service-public.gouv.fr/particuliers/actualites/A14389";
const RESORT_MAP =
  "https://www.alpedhuez.com/wp-content/uploads/2026/11/PLAN-Station_alpedhuez-hiver_2026_2027.pdf";

export const winterTransportChapter = {
  edition: "winter",
  slug: "transport",
  order: 4,
  title: "Getting there",
  summary:
    "Package travel, the three arrival airports, the Geneva caveat, the Transportation Pass for village nights, and the winter-tyre rule for the 21-hairpin drive.",
  lastVerified: CHECKED,
  related: [
    "winter/accommodation",
    "winter/tickets-and-packages",
    "winter/stages-and-hours",
    "belgium/transport",
  ],
  sources: [
    { id: "s1", title: "Tomorrowland Winter: how to get there", url: GET_THERE, checkedOn: CHECKED },
    {
      id: "s2",
      title: "Tomorrowland Winter: festival ticket, accommodation and transport",
      url: TRANSPORT_PACKAGES,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter: Transportation Pass",
      url: TRANSPORT_PASS,
      checkedOn: CHECKED,
    },
    { id: "s4", title: "Tomorrowland Winter: opening hours", url: HOURS, checkedOn: CHECKED },
    {
      id: "s5",
      title: "Tomorrowland Winter: taxis and shuttles in Alpe d'Huez",
      url: TAXIS,
      checkedOn: CHECKED,
    },
    { id: "s6", title: "Transaltitude: Alpe d'Huez", url: TRANSALTITUDE, checkedOn: CHECKED },
    {
      id: "s7",
      title: "Transaltitude: Alpe d'Huez timetable, winter 2026–27",
      url: TRANSALTITUDE_TIMETABLE,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "Ben's Bus: Alpe d'Huez airport transfers",
      url: BENSBUS_AIRPORTS,
      checkedOn: CHECKED,
    },
    { id: "s9", title: "Altibus: navettes Alpe d'Huez", url: ALTIBUS, checkedOn: CHECKED },
    { id: "s10", title: "Rhônexpress: Lyon airport tram", url: RHONEXPRESS, checkedOn: CHECKED },
    { id: "s11", title: "Alpe d'Huez: parking", url: PARKING, checkedOn: CHECKED },
    {
      id: "s12",
      title: "Alpe d'Huez: free urban transport",
      url: RESORT_BUSES,
      checkedOn: CHECKED,
    },
    {
      id: "s13",
      title: "Alpe d'Huez: transport to the resort",
      url: TOWN_LIFTS,
      checkedOn: CHECKED,
    },
    {
      id: "s14",
      title: "Service-public.fr: winter equipment requirements",
      url: TYRE_RULE,
      checkedOn: CHECKED,
    },
    {
      id: "s15",
      title: "Alpe d'Huez: winter resort map 2026–2027",
      url: RESORT_MAP,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "three-ways-in", text: "Three ways in" },
    {
      type: "p",
      text: "Every route to Alpe d'Huez finishes with a road transfer up the mountain. Tomorrowland sells coach, flight and train packages with that transfer arranged, or you can book a scheduled flight or train and a transfer separately.",
      sources: ["s1", "s2"],
    },
    {
      type: "facts",
      caption: "Which travel package fits which ticket length",
      rows: [
        {
          label: "Flight packages",
          value: "From Amsterdam, Brussels and Barcelona into Lyon Airport; bookable with a 4-day or a 7-day package",
          sources: ["s2"],
        },
        {
          label: "Bus packages",
          value: "Belgium only, from Antwerp and Brussels; bookable with a 4-day package only",
          sources: ["s2"],
        },
        {
          label: "Train packages",
          value: "From Amsterdam; bookable with a 7-day package only",
          sources: ["s2"],
        },
        {
          label: "Included in a flight package",
          value: "Return flight, the transfer between Lyon Airport and Alpe d'Huez, the festival ticket and the lift and ski pass",
          sources: ["s2"],
        },
      ],
    },
    {
      type: "p",
      text: "The Belgium restriction is worth reading twice. The bus packages are not sold from the Netherlands, Switzerland or France for 2027, and they are not sold with the 7-day week, so the coach and the full week cannot be combined.",
      sources: ["s2"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Declare ski equipment before departure",
      text: "Winter sports equipment carried on a flight or coach package has to be declared in Manage My Booking. The baggage allowance differs by mode: a bus package allows 2 kg of hand luggage, a flight package 10 to 12 kg.",
      sources: ["s2"],
    },
    { type: "h2", id: "airports", text: "Airports and road times" },
    {
      type: "p",
      text: "Lyon is the airport the official flight packages use. Grenoble is the closest of the three by road. Geneva is the longest by road of the three, and it carries a service question that the other two do not.",
      sources: ["s1", "s2", "s8"],
    },
    {
      type: "facts",
      caption: "Road times to Alpe d'Huez",
      rows: [
        {
          label: "Lyon Airport",
          value: "About 2 hours 30 minutes by road",
          sources: ["s8"],
        },
        {
          label: "Grenoble Airport",
          value: "About 2 hours by road",
          sources: ["s8"],
        },
        {
          label: "Geneva Airport",
          value: "About 3 hours 15 minutes by road; Altibus quotes 4 hours by coach",
          sources: ["s8", "s9"],
        },
        {
          label: "Grenoble station",
          value: "About 90 minutes per Tomorrowland; 1 hour 45 on the Transaltitude timetable",
          sources: ["s1", "s6"],
        },
      ],
    },
    {
      type: "p",
      text: "Lyon Airport connects to Lyon Part-Dieu by the Rhônexpress tram, which takes 30 minutes and runs every 15 minutes between 04:25 and 00:00. That is the link that turns a flight into a train journey to Grenoble if you are arranging the transfer yourself.",
      sources: ["s10"],
    },
    {
      type: "p",
      text: "Coach transfers from Ben's Bus run from Lyon Airport every Saturday, taking about 2 hours 30 minutes, and from Grenoble Airport on any day of the week that has a scheduled flight; the operator states no Wednesday exclusion. Fares for the 2026–27 season are on the operators' own booking pages and are theirs to change, so book against the fare quoted for your date.",
      sources: ["s8"],
    },
    {
      /* The fares themselves are records, not prose: `src/data/winter/shuttles.ts`
         holds the operators' own 2026–27 figures, and each row prints the
         operator's notes beside the price it qualifies. */
      type: "data",
      edition: "winter",
      collection: "shuttles",
      idPrefix: "bens-bus-",
      caption: "Ben's Bus fares for the 2026–27 season, Lyon and Grenoble Airports",
    },
    { type: "h2", id: "the-geneva-caveat", text: "The Geneva caveat" },
    {
      type: "p",
      text: "Do not plan a Geneva arrival on the assumption that a shuttle is running. Altibus, the operator Tomorrowland lists for Geneva, states that the Geneva to Alpe d'Huez shuttle did not run in the 2025/26 winter season.",
      sources: ["s9"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Geneva: the published fare is not evidence of a running service",
      text: "Altibus publishes adult and child return fares for the Geneva route, yet the same page says the shuttle did not operate in winter 2025/26. Tomorrowland's travel page still lists Altibus for Geneva. Confirm operation with the operator before you book a flight into Geneva; a fare on a page is not a timetable.",
      sources: ["s9", "s1"],
    },
    {
      /* The published fare is a record, and the record's own notes carry the
         operator's sentence that the route did not run. The renderer prints that
         note inside the price cell, so the figure can never appear alone. */
      type: "data",
      edition: "winter",
      collection: "shuttles",
      idPrefix: "altibus-geneva-",
      caption: "The Altibus Geneva fare, with the operator's own statement about the route",
    },
    {
      type: "p",
      text: "Lyon and Grenoble do not carry that question: Ben's Bus publishes 2026–27 transfers from both, with Lyon running every Saturday, and Lyon is the airport the official flight packages use.",
      sources: ["s2", "s8"],
    },
    { type: "h2", id: "coach-from-grenoble", text: "The coach from Grenoble" },
    {
      type: "p",
      text: "Transaltitude runs the scheduled coach between Grenoble and the resort. Its 2026–27 timetable covers 19 December 2026 to 28 March 2027 and lists L'Éclose as a served stop, so the stop itself is not withdrawn for festival week.",
      sources: ["s6", "s7"],
    },
    {
      type: "p",
      text: "Two things change in festival week. The Palais des Sports stop is closed for the festival, and the operator states that some stops are not served, directing passengers to the nearest one. Check the stop list for your date rather than assuming the stop you want is running.",
      sources: ["s6"],
    },
    {
      type: "p",
      text: "A reservation guarantees a seat: the operator's own wording is that one reserved seat is one guaranteed place on board. Booking ahead is still the sensible move in festival week, and a full-fare ticket can be bought on board.",
      sources: ["s7"],
    },
    {
      type: "p",
      text: "The included luggage allowance is one suitcase up to 150 cm total dimensions and 20 kg, one small cabin bag, and one ski or snowboard set with boots. Extra luggage is charged per piece.",
      sources: ["s7", "s6"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "shuttles",
      idPrefix: "transaltitude-",
      caption: "Transaltitude fares for the 2026–27 season, Grenoble to Alpe d'Huez",
    },
    { type: "h2", id: "local-transport", text: "Getting around the resort" },
    {
      type: "p",
      text: "The resort runs four free bus lines in winter, and no ticket is needed. Three lifts inside the resort are also free in winter: the Télécentre, the Alpe Express and the Huez Express.",
      sources: ["s12", "s13"],
    },
    {
      type: "facts",
      caption: "Free transport inside the resort",
      rows: [
        {
          label: "Resort buses",
          value: "Four free Resalp lines in winter, no ticket needed",
          sources: ["s12"],
        },
        {
          label: "Télécentre",
          value: "From Place Paganon via Avenue des Jeux to Grandes Rousses 1800 and the snow front",
          sources: ["s13"],
        },
        {
          label: "Alpe Express",
          value: "From Place Paganon to Éclose and Bergers",
          sources: ["s13"],
        },
        {
          label: "Huez Express",
          value: "Between Huez village and Alpe d'Huez",
          sources: ["s13"],
        },
        {
          label: "Free lift hours",
          value: "Not published for 2026–27; the last published timetable was for 2024–25",
          sources: ["s13"],
        },
      ],
    },
    {
      type: "p",
      text: "The free lifts carry you around the village; they are not the mountain lifts. Reaching the stages above the resort uses the lift and ski pass that every ticket includes.",
      sources: ["s13"],
    },
    { type: "h2", id: "night-transport", text: "Village nights and the Transportation Pass" },
    {
      type: "p",
      text: "If you sleep outside Alpe d'Huez, the evening return is a paid product. The Transportation Pass buys the Oz 3300 night lift, a journey of about 20 minutes, plus dedicated night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans.",
      sources: ["s3"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      idPrefix: "transportation-pass",
      caption: "Transportation Pass, 2027",
    },
    {
      type: "p",
      text: "The Oz 3300 lift runs between 18:30 and 21:00 and between 22:30 and 00:30, extending to 02:00 on MainStage days. The pass is included automatically in packages sold in Oz 3300, so a package there does not need it bought separately.",
      sources: ["s3"],
    },
    {
      type: "p",
      text: "The coaches to Villard-Reculas and Auris-en-Oisans run only on the days the MainStage is open, so they do not cover the Saturday-to-Monday pre-days.",
      sources: ["s3", "s4"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Do not plan to walk back to a village",
      text: "Walking between Alpe d'Huez and the surrounding villages is prohibited by the organiser. A village bed without the Transportation Pass leaves you with no sanctioned way back after the evening programme.",
      sources: ["s1", "s3"],
    },
    { type: "h2", id: "daytime-lifts", text: "Daytime lifts to the villages" },
    {
      type: "p",
      text: "The lift and ski pass covers daytime access to the surrounding villages, but the connections have fixed last departures and they do not wait for the music. Only the lifts running from the mountain stages back down to Alpe d'Huez keep operating until the stages close.",
      sources: ["s4"],
    },
    {
      type: "facts",
      caption: "Last daytime lift to each village",
      rows: [
        { label: "Auris", value: "16:30, skiers only", sources: ["s4"] },
        { label: "Villard-Reculas", value: "16:40, skiers only", sources: ["s4"] },
        { label: "Vaujany", value: "16:30", sources: ["s4"] },
        { label: "Oz 3300 and Allemond", value: "16:45", sources: ["s4"] },
        { label: "Huez", value: "17:50", sources: ["s4"] },
      ],
    },
    {
      type: "p",
      text: "Those times are the real curfew for the daytime programme if you are staying in a village, and they fall before the mountain stages close on the longer days.",
      sources: ["s4"],
    },
    { type: "h2", id: "driving", text: "Driving" },
    {
      type: "p",
      text: "The road climbs 21 hairpin turns to the resort. Winter equipment law applies on the way up: in the Isère mountain zones, from 1 November to 31 March, a vehicle must either carry removable anti-slip devices for at least two driven wheels or be fitted with four winter tyres.",
      sources: ["s1", "s14"],
    },
    {
      type: "p",
      text: "Chains are one way to comply, not the only way. Four 3PMSF winter tyres satisfy the rule on their own, with no chains carried, and the obligation is a legal requirement rather than advice from the organiser.",
      sources: ["s14"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Tyres or chains, not both by default",
      text: "If the car is on four winter tyres it already meets the requirement. Carrying chains as well is a choice, not a second obligation, and the rule that matters is the 1 November to 31 March window in the Isère mountain zones.",
      sources: ["s14"],
    },
    { type: "h2", id: "parking", text: "Parking" },
    {
      type: "p",
      text: "There are six covered car parks in the resort: Coulet with 95 spaces, Cristal de l'Alpe with 165, Éclose with 319, Bergers with 260, Rif Nel with 230 and Jeux with 120. Éclose is the largest.",
      sources: ["s11"],
    },
    {
      type: "p",
      text: "Covered parking costs €18 per day or €95 per week for the 2026–27 season, and the first hour is free. Free outdoor car parks are marked on the resort map, so a week's parking need not be paid for at all if you are willing to park in the open.",
      sources: ["s11", "s15"],
    },
    {
      type: "p",
      text: "Local taxis are listed by Tomorrowland, including Taxis Chalvin, Alpe d'Huez Taxis and Alpeventure. No official taxi tariff is published, so ask for the price when you book rather than budgeting from a figure.",
      sources: ["s5"],
    },
  ],
} satisfies GuideChapter;

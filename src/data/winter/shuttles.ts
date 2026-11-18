import type { Shuttle } from "../schemas";

/**
 * Winter coach and shuttle fares to Alpe d'Huez.
 *
 * The Transaltitude and Ben's Bus figures are the operators' own 2026–27 season
 * fares, the season that contains the 20–27 March 2027 festival. Tomorrowland's
 * own 2027 shuttle departures are published without prices, so no Tomorrowland
 * shuttle is recorded here; see `docs/data/winter-omissions.md`.
 *
 * `shuttleSchema` requires a price, which is why the Altibus Geneva service
 * carries its published return fare even though the operator says the route did
 * not run in the last winter season. The `notes` field states that in the
 * operator's own words so the record cannot be read as a working route.
 */
export const winterShuttles: readonly Shuttle[] = [
  {
    id: "transaltitude-grenoble-single",
    edition: "winter",
    name: "Transaltitude coach from Grenoble to Alpe d'Huez (single)",
    route: "Grenoble coach station to Alpe d'Huez",
    priceEur: 23.5,
    operator: "Transaltitude",
    notes:
      "Web fare for the 2026–27 season. A reduced fare of EUR 20 applies to travellers under 26 and over 70. A TRIBU ticket for five people costs EUR 75. Extra luggage is EUR 50 per piece.",
    bookingUrl: "https://www.transaltitude.fr/fr/station/lalpe-dhuez/",
    source: {
      url: "https://www.transaltitude.fr/fr/station/lalpe-dhuez/",
      title: "Transaltitude: Alpe d'Huez",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "transaltitude-grenoble-return",
    edition: "winter",
    name: "Transaltitude coach from Grenoble to Alpe d'Huez (return)",
    route: "Grenoble coach station to Alpe d'Huez and back",
    priceEur: 42,
    operator: "Transaltitude",
    notes:
      "Web fare for the 2026–27 season. The reduced return fare is EUR 36, and a TRIBU return for five people costs EUR 143. One suitcase up to 150 cm in total dimensions and 20 kg, one small cabin bag and one ski or snowboard set with boots are included.",
    bookingUrl: "https://www.transaltitude.fr/fr/station/lalpe-dhuez/",
    source: {
      url: "https://www.transaltitude.fr/fr/station/lalpe-dhuez/",
      title: "Transaltitude: Alpe d'Huez",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "bens-bus-lyon-single",
    edition: "winter",
    name: "Ben's Bus from Lyon Airport to Alpe d'Huez (single)",
    route: "Lyon Airport to Alpe d'Huez",
    priceEur: 50,
    operator: "Ben's Bus",
    notes:
      "2026–27 season fare of GBP 43.50, which the operator also states as EUR 50. Transfers run every Saturday and the drive is about 2 hours 30 minutes over 148 km. A return is listed at GBP 79 (EUR 91.50).",
    bookingUrl: "https://www.bensbus.co.uk/ski-transfer/lyon-airport-to-alpe-dhuez/",
    source: {
      url: "https://www.bensbus.co.uk/cheap-ski-transfers/",
      title: "Ben's Bus: cheap ski transfers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "bens-bus-lyon-return",
    edition: "winter",
    name: "Ben's Bus from Lyon Airport to Alpe d'Huez (return)",
    route: "Lyon Airport to Alpe d'Huez and back",
    priceEur: 91.5,
    operator: "Ben's Bus",
    notes:
      "2026–27 season fare of GBP 79, which the operator also states as EUR 91.50. Saturday service only; a single is listed at GBP 43.50 (EUR 50).",
    bookingUrl: "https://www.bensbus.co.uk/ski-transfer/lyon-airport-to-alpe-dhuez/",
    source: {
      url: "https://www.bensbus.co.uk/cheap-ski-transfers/",
      title: "Ben's Bus: cheap ski transfers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "bens-bus-grenoble-single",
    edition: "winter",
    name: "Ben's Bus from Grenoble Airport to Alpe d'Huez (single)",
    route: "Grenoble Airport to Alpe d'Huez",
    priceEur: 41.5,
    operator: "Ben's Bus",
    notes:
      "2026–27 season fare of GBP 36, which the operator also states as EUR 41.50. Grenoble Airport to Alpe d'Huez takes about 2 hours.",
    bookingUrl: "https://www.bensbus.co.uk/ski-transfer/grenoble-airport-alpe-dhuez-transfers/",
    source: {
      url: "https://www.bensbus.co.uk/cheap-ski-transfers/",
      title: "Ben's Bus: cheap ski transfers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "bens-bus-grenoble-return",
    edition: "winter",
    name: "Ben's Bus from Grenoble Airport to Alpe d'Huez (return)",
    route: "Grenoble Airport to Alpe d'Huez and back",
    priceEur: 73,
    operator: "Ben's Bus",
    notes:
      "2026–27 season fare of GBP 63, which the operator also states as EUR 73. A single is listed at GBP 36 (EUR 41.50).",
    bookingUrl: "https://www.bensbus.co.uk/ski-transfer/grenoble-airport-alpe-dhuez-transfers/",
    source: {
      url: "https://www.bensbus.co.uk/cheap-ski-transfers/",
      title: "Ben's Bus: cheap ski transfers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "altibus-geneva-return",
    edition: "winter",
    name: "Altibus coach from Geneva Airport to Alpe d'Huez (adult return) — route not operated in the last winter season",
    route: "Geneva Airport to Alpe d'Huez",
    priceEur: 80,
    operator: "Altibus",
    notes:
      'Past-season context, quoted from the operator: "La navette Genève – Alpe d\'Huez ne circulera pas pendant la saison d\'hiver 2025/2026" — the Geneva – Alpe d\'Huez shuttle did not run that winter. Tomorrowland still lists Altibus as a Geneva option, so this is a published fare for a suspended route, not a working service: confirm operation with Altibus before booking a Geneva arrival. Adult return EUR 80, child return EUR 75.',
    bookingUrl: "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/",
    source: {
      url: "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/",
      title: "Altibus: navettes Alpe d'Huez",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];

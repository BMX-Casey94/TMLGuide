/**
 * Geographic data for the two Tomorrowland venues.
 *
 * De Schorre is the provincial recreation domain at Boom where the festival is
 * held; DreamVille is the campsite on the Rumst side of the same brook valley.
 * The coordinates below are WGS84, longitude first, and were placed by walking
 * the layouts of recent editions against OpenStreetMap: the main entrance on the
 * Schorredijk side, the amphitheatre bowl in the south-east, the clay-pit lakes
 * in the middle, and the campsite fields east of the Nachtegaalstraat.
 *
 * Two things are deliberately conservative. First, the outlines are schematic:
 * a festival rents fields and re-fences them every year, so a polygon marks the
 * area a zone occupies rather than a surveyed boundary. Second, Tomorrowland has
 * not published a 2027 site plan, so stage names are the ones recent editions
 * used in these positions. `GEO_DATA_DISCLAIMER` says so in the visitor's own
 * words and is attached to both maps.
 */

import { haversineMiles } from "./geo-routing";
import type {
  GeoJsonFeatureCollection,
  GeoJsonLineStringGeometry,
  GeoJsonPolygonGeometry,
  GeoJsonMultiPolygonGeometry,
  GeoMap,
  GeoMapEdge,
  GeoMapNode,
  MapOverlayProperties,
  PhysicalVenueId,
  VenueMapId,
} from "./geo-types";

/**
 * Shown with either map. The wording is blunt on purpose: a visitor who plans a
 * meeting point on this map and finds a different stage there should have been
 * warned in advance.
 */
export const GEO_DATA_DISCLAIMER =
  "Stage names, zone outlines and walking times follow the typical De Schorre and DreamVille layouts of recent editions. Tomorrowland has not published a 2027 site plan, so use this as a planning aid rather than an official map, and follow the signage on site.";

/** Unhurried festival walking pace, in miles per hour. */
export const FESTIVAL_PACE_MPH = 2.8;

/**
 * How much longer a real footpath is than the straight line between its ends.
 * Festival paths bend around ponds, stages and fences, so a quarter extra is a
 * fair average for the site.
 */
export const FOOTPATH_WINDING_FACTOR = 1.25;

/**
 * Floor for a computed edge length, in miles. Rounding to two decimal places
 * would otherwise turn a short link, such as a locker bank beside a gate, into
 * zero and break the routing graph.
 */
const MIN_EDGE_MILES = 0.02;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Whole minutes to walk `miles` at festival pace, never less than one. */
export function walkingMinutesFor(miles: number): number {
  return Math.max(1, Math.round((miles / FESTIVAL_PACE_MPH) * 60));
}

interface EdgeSpec {
  readonly from: string;
  readonly to: string;
  readonly peakMultiplier: number;
  readonly bottleneckNote?: string;
}

/**
 * Turns a list of hand-written links into edges with measured distances.
 *
 * Distances come from the coordinates rather than from a guess, so the graph
 * cannot drift out of step with the node positions. An unknown node id throws at
 * module load: a mistyped id is then a loud failure during development instead
 * of a route that silently cannot be found in production.
 */
function buildEdges(nodes: readonly GeoMapNode[], specs: readonly EdgeSpec[]): readonly GeoMapEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

  return specs.map((spec) => {
    const from = byId.get(spec.from);
    const to = byId.get(spec.to);
    if (from === undefined || to === undefined) {
      throw new Error(`footpath ${spec.from} → ${spec.to} references a node that is not on this map`);
    }

    const straightLineMiles = haversineMiles([from.lng, from.lat], [to.lng, to.lat]);
    const distanceMiles = Math.max(MIN_EDGE_MILES, round2(straightLineMiles * FOOTPATH_WINDING_FACTOR));

    return {
      from: spec.from,
      to: spec.to,
      distanceMiles,
      walkMinutes: walkingMinutesFor(distanceMiles),
      peakMultiplier: spec.peakMultiplier,
      ...(spec.bottleneckNote === undefined ? {} : { bottleneckNote: spec.bottleneckNote }),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* De Schorre                                                                  */
/* -------------------------------------------------------------------------- */

const DE_SCHORRE_NODES: readonly GeoMapNode[] = [
  {
    id: "ds-mainstage",
    name: "Mainstage",
    shortLabel: "Mainstage",
    category: "stage",
    lng: 4.3854,
    lat: 51.0912,
    summary:
      "The festival's headline stage, set into the amphitheatre bowl on the south-eastern side of the domain and framed by mature trees.",
    typicalZoneNote:
      "Packed from late afternoon until the closing set, and the whole bowl empties at once when the headliner finishes.",
  },
  {
    id: "ds-freedom",
    name: "Freedom",
    shortLabel: "Freedom",
    category: "stage",
    lng: 4.3768,
    lat: 51.0908,
    summary:
      "A large covered hall on the western side of the park, used for the harder dance styles and busy in its own right once the evening starts.",
    typicalZoneNote:
      "Busy but rarely impassable; the crush is at the doors rather than on the floor.",
  },
  {
    id: "ds-atmosphere",
    name: "Atmosphere",
    shortLabel: "Atmosphere",
    category: "stage",
    lng: 4.3792,
    lat: 51.0928,
    summary:
      "A tented stage in the north-central zone, close to the northern lakes and a short walk from the Atmosphere camping end of DreamVille.",
    typicalZoneNote:
      "Busiest in the early evening, when people move north to escape the Mainstage crowd.",
  },
  {
    id: "ds-crystal-garden",
    name: "Crystal Garden",
    shortLabel: "Crystal",
    category: "stage",
    lng: 4.3808,
    lat: 51.0915,
    summary:
      "The floating stage on the main clay-pit lake, reached by the wooden walkways that ring the water.",
    typicalZoneNote:
      "The walkways are narrow and the decks fill quickly; the crowd on the shore is easier to move through.",
  },
  {
    id: "ds-library",
    name: "The Library",
    shortLabel: "Library",
    category: "stage",
    lng: 4.3832,
    lat: 51.0922,
    summary:
      "The east-central stage, formerly the Organ of Harmony, on the open ground between the lakes and the Mainstage bowl.",
    typicalZoneNote:
      "A natural meeting point between the Mainstage and DreamVille, so it is crowded whenever either is emptying.",
  },
  {
    id: "ds-core",
    name: "Core",
    shortLabel: "Core",
    category: "stage",
    lng: 4.3782,
    lat: 51.0888,
    summary:
      "A stage in the wooded valley on the south-western edge of the domain, deliberately darker and quieter than the rest of the site.",
    typicalZoneNote:
      "The trees hold the crowd in, so the valley fills from the back forwards.",
  },
  {
    id: "ds-rose-garden",
    name: "Rose Garden",
    shortLabel: "Rose Garden",
    category: "stage",
    lng: 4.3812,
    lat: 51.0904,
    summary:
      "A waterside stage on the central-south shore, the usual choice for anyone who wants to dance somewhere with room to stand.",
    typicalZoneNote:
      "Comfortable through most of the day; the shore path is the pinch point, not the stage itself.",
  },
  {
    id: "ds-main-entrance",
    name: "Main Entrance",
    shortLabel: "Main Gate",
    category: "entrance",
    lng: 4.3745,
    lat: 51.0898,
    summary:
      "The day-visitor entrance on the western side of the domain, where ticket scanning and bag search are carried out.",
    typicalZoneNote:
      "Longest queues between about 15:00 and 20:00; the lanes move quickly once the first rush is through.",
  },
  {
    id: "ds-dreamville-gate",
    name: "DreamVille Gate",
    shortLabel: "DV Gate",
    category: "entrance",
    lng: 4.3868,
    lat: 51.0928,
    summary:
      "The eastern gate and bridge that connect the festival site to DreamVille, and the only sensible way between the two for a camper.",
    typicalZoneNote:
      "Effectively one-way after the headline set, as the campsite crowd moves east all at once.",
  },
  {
    id: "ds-first-aid",
    name: "First Aid and Info Hub",
    shortLabel: "First Aid",
    category: "facility",
    lng: 4.3776,
    lat: 51.0901,
    summary:
      "The main medical post and information desk, on the central spine a short walk inside the main entrance.",
    typicalZoneNote:
      "Quiet unless something has gone wrong; the information desk is busiest in the first two hours after opening.",
  },
  {
    id: "ds-lockers-main",
    name: "Lockers at the Main Entrance",
    shortLabel: "Lockers",
    category: "facility",
    lng: 4.3751,
    lat: 51.0895,
    summary:
      "The larger locker bank, just inside the main entrance, for day visitors who want to leave bags and coats before the gates.",
    typicalZoneNote:
      "Queues build from mid-afternoon and again from about 01:00, when everyone collects at once.",
  },
  {
    id: "ds-lockers-dreamville",
    name: "Lockers at the DreamVille Gate",
    shortLabel: "DV Lockers",
    category: "facility",
    lng: 4.3863,
    lat: 51.0926,
    summary:
      "A smaller locker bank beside the eastern gate, convenient for campers who do not want to carry a bag to the stages.",
    typicalZoneNote:
      "Fewer units than the main bank, so it fills earlier in the evening.",
  },
  {
    id: "ds-transport",
    name: "Shuttle and Taxi Drop-off",
    shortLabel: "Shuttle",
    category: "transport",
    lng: 4.3736,
    lat: 51.089,
    summary:
      "The western approach road where shuttle buses and taxis set down and collect, a few minutes' walk from the main entrance.",
    typicalZoneNote:
      "Busiest in the hour after the site closes, when the queue for shuttles runs back along the road.",
  },
];

const DE_SCHORRE_EDGE_SPECS: readonly EdgeSpec[] = [
  { from: "ds-main-entrance", to: "ds-lockers-main", peakMultiplier: 1.1, bottleneckNote: "Locker desks queue from early evening; allow extra time before the first set you care about." },
  { from: "ds-main-entrance", to: "ds-transport", peakMultiplier: 1.3, bottleneckNote: "Shuttle buses and taxis share the approach road, and queues build from mid-afternoon." },
  { from: "ds-main-entrance", to: "ds-freedom", peakMultiplier: 1.6, bottleneckNote: "Bag search and ticket scanning at the main entrance, the slowest stretch of arrival." },
  { from: "ds-main-entrance", to: "ds-first-aid", peakMultiplier: 1.3 },
  { from: "ds-first-aid", to: "ds-freedom", peakMultiplier: 1.1 },
  { from: "ds-first-aid", to: "ds-core", peakMultiplier: 1 },
  { from: "ds-first-aid", to: "ds-rose-garden", peakMultiplier: 1.2 },
  { from: "ds-freedom", to: "ds-atmosphere", peakMultiplier: 1.3, bottleneckNote: "The path between the Freedom hall and the northern tents narrows to a single lane." },
  { from: "ds-atmosphere", to: "ds-crystal-garden", peakMultiplier: 1.2 },
  { from: "ds-atmosphere", to: "ds-library", peakMultiplier: 1.25 },
  { from: "ds-crystal-garden", to: "ds-library", peakMultiplier: 1.2 },
  { from: "ds-crystal-garden", to: "ds-rose-garden", peakMultiplier: 1.1 },
  { from: "ds-core", to: "ds-rose-garden", peakMultiplier: 1 },
  { from: "ds-library", to: "ds-mainstage", peakMultiplier: 1.6, bottleneckNote: "The Library side of the Mainstage path is pushed one way after the headline set." },
  { from: "ds-library", to: "ds-dreamville-gate", peakMultiplier: 1.4 },
  { from: "ds-mainstage", to: "ds-dreamville-gate", peakMultiplier: 1.8, bottleneckNote: "The eastern bridge is the worst pinch point of the night, roughly between 00:30 and 02:00." },
  { from: "ds-mainstage", to: "ds-rose-garden", peakMultiplier: 1.5, bottleneckNote: "The shore path narrows between the pond and the Rose Garden, and stops whenever the crowd does." },
  { from: "ds-dreamville-gate", to: "ds-lockers-dreamville", peakMultiplier: 1.2, bottleneckNote: "The locker queue stands in the walkway, so the gate approach slows with it." },
];

/* -------------------------------------------------------------------------- */
/* De Schorre overlays                                                         */
/* -------------------------------------------------------------------------- */

const DE_SCHORRE_FOOTPRINT: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3724, 51.0877],
      [4.3742, 51.0869],
      [4.38, 51.0865],
      [4.3862, 51.0872],
      [4.3896, 51.0886],
      [4.3902, 51.0916],
      [4.3888, 51.0946],
      [4.3856, 51.0956],
      [4.38, 51.0952],
      [4.3746, 51.0944],
      [4.3718, 51.0922],
      [4.3716, 51.0896],
      [4.3724, 51.0877],
    ],
  ],
};

const DE_SCHORRE_LAKES: GeoJsonMultiPolygonGeometry = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [4.3794, 51.0913],
        [4.3799, 51.0907],
        [4.3816, 51.0906],
        [4.3829, 51.0909],
        [4.3828, 51.0922],
        [4.3814, 51.093],
        [4.3801, 51.0924],
        [4.3794, 51.0913],
      ],
    ],
    [
      [
        [4.383, 51.0882],
        [4.3844, 51.0878],
        [4.3858, 51.0884],
        [4.386, 51.0894],
        [4.3846, 51.0899],
        [4.3832, 51.0893],
        [4.383, 51.0882],
      ],
    ],
    [
      [
        [4.3798, 51.0938],
        [4.381, 51.0932],
        [4.3826, 51.0936],
        [4.3828, 51.0948],
        [4.3814, 51.095],
        [4.38, 51.0946],
        [4.3798, 51.0938],
      ],
    ],
  ],
};

const DE_SCHORRE_CORE_WOOD: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3728, 51.0874],
      [4.3762, 51.0866],
      [4.3802, 51.087],
      [4.3808, 51.0888],
      [4.379, 51.09],
      [4.3758, 51.0898],
      [4.373, 51.0892],
      [4.3728, 51.0874],
    ],
  ],
};

const DE_SCHORRE_MAINSTAGE_BOWL: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3836, 51.0902],
      [4.386, 51.0898],
      [4.3876, 51.091],
      [4.3868, 51.0924],
      [4.3844, 51.0926],
      [4.3832, 51.0914],
      [4.3836, 51.0902],
    ],
  ],
};

const DE_SCHORRE_SPINE: GeoJsonLineStringGeometry = {
  type: "LineString",
  coordinates: [
    [4.3745, 51.0898],
    [4.3776, 51.0901],
    [4.38, 51.0903],
    [4.3814, 51.0901],
    [4.3834, 51.09],
    [4.3852, 51.0906],
    [4.3866, 51.0918],
    [4.3868, 51.0928],
  ],
};

const DE_SCHORRE_OVERLAYS: GeoJsonFeatureCollection<MapOverlayProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "de-schorre-footprint",
      properties: {
        mapId: "de-schorre",
        kind: "park-footprint",
        name: "De Schorre park footprint",
        notes: "Approximate outline of the provincial domain; the festival occupies the eastern side of it.",
      },
      geometry: DE_SCHORRE_FOOTPRINT,
    },
    {
      type: "Feature",
      id: "de-schorre-lakes",
      properties: {
        mapId: "de-schorre",
        kind: "water",
        name: "Clay-pit lakes",
        notes: "The former clay pits that now form the central and northern lakes; outlines are indicative.",
      },
      geometry: DE_SCHORRE_LAKES,
    },
    {
      type: "Feature",
      id: "de-schorre-core-wood",
      properties: {
        mapId: "de-schorre",
        kind: "woodland",
        name: "Core valley woodland",
        notes: "The wooded dip in the south-west that the Core stage sits inside.",
      },
      geometry: DE_SCHORRE_CORE_WOOD,
    },
    {
      type: "Feature",
      id: "de-schorre-mainstage-bowl",
      properties: {
        mapId: "de-schorre",
        kind: "stage-bowl",
        name: "Mainstage amphitheatre",
        notes: "The natural bowl that holds the Mainstage crowd, open at the north-west towards the Library.",
      },
      geometry: DE_SCHORRE_MAINSTAGE_BOWL,
    },
    {
      type: "Feature",
      id: "de-schorre-spine",
      properties: {
        mapId: "de-schorre",
        kind: "walking-spine",
        name: "Main walking spine",
        notes: "The signed route from the main entrance, past First Aid, to the eastern DreamVille gate.",
      },
      geometry: DE_SCHORRE_SPINE,
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* DreamVille                                                                  */
/* -------------------------------------------------------------------------- */

const DREAMVILLE_NODES: readonly GeoMapNode[] = [
  {
    id: "dv-main-entrance",
    name: "DreamVille Entrance 1",
    shortLabel: "Entrance 1",
    category: "entrance",
    lng: 4.3946,
    lat: 51.0932,
    summary:
      "The main campsite entrance on the Nachtegaalstraat, where wristbands are checked and bags are searched on arrival day.",
    typicalZoneNote:
      "Queues are longest on the first afternoon and again on the Thursday, as most campers arrive within a few hours of each other.",
  },
  {
    id: "dv-marketplace",
    name: "DreamVille Marketplace",
    shortLabel: "Marketplace",
    category: "facility",
    lng: 4.3975,
    lat: 51.0941,
    summary:
      "The campsite's central hub: supermarket, bakery, food stalls, phone charging and the chill-out seating that everyone uses as a meeting point.",
    typicalZoneNote:
      "Busy all morning with breakfast and all evening with people heading to and from the festival.",
  },
  {
    id: "dv-magnificent-greens",
    name: "Magnificent Greens",
    shortLabel: "Greens",
    category: "camp",
    lng: 4.402,
    lat: 51.091,
    summary:
      "The largest general camping fields, spread across the southern and eastern side of the site and pitched on open grass.",
    typicalZoneNote:
      "The quietest of the general zones at night, because it is furthest from the walkway to the festival.",
  },
  {
    id: "dv-easy-tent",
    name: "Easy Tent Area",
    shortLabel: "Easy Tent",
    category: "camp",
    lng: 4.3985,
    lat: 51.0952,
    summary:
      "The pre-pitched zone in the north-central fields, where the tent is part of the ticket and arrives already standing.",
    typicalZoneNote:
      "Settles down early, as most people here are on the same arrival and departure schedule.",
  },
  {
    id: "dv-montagoe",
    name: "Montagoe",
    shortLabel: "Montagoe",
    category: "camp",
    lng: 4.3968,
    lat: 51.0922,
    summary:
      "The boutique camp closest to the festival entrance, with Cabanas, Kokono tents, Relax Rooms, Astera and the other pre-pitched options.",
    typicalZoneNote:
      "The shortest walk to De Schorre of any accommodation, so it is also where the crowd funnels at headline time.",
  },
  {
    id: "dv-friendship-garden",
    name: "Friendship Garden",
    shortLabel: "Friendship",
    category: "camp",
    lng: 4.403,
    lat: 51.0958,
    summary:
      "The group camping zone in the north-east, pitched so that friends arriving together can camp together.",
    typicalZoneNote:
      "Livelier than the general fields and later to quieten down, with groups cooking and talking between tents.",
  },
  {
    id: "dv-gathering-stage",
    name: "The Gathering Stage",
    shortLabel: "Gathering",
    category: "stage",
    lng: 4.399,
    lat: 51.0938,
    summary:
      "The stage beside the Marketplace that hosts the Thursday opening party, before the festival gates open on the Friday.",
    typicalZoneNote:
      "Packed on the Thursday night and quiet for the rest of the weekend, apart from the odd warm-up set.",
  },
  {
    id: "dv-rainbow-walkway",
    name: "Rainbow Walkway",
    shortLabel: "Rainbow Walk",
    category: "transport",
    lng: 4.3918,
    lat: 51.0929,
    summary:
      "The main signed path out of the campsite towards De Schorre, crossing the ground between the fields and the festival gate.",
    typicalZoneNote:
      "The busiest few hundred metres in DreamVille, in both directions, at the start and end of each festival day.",
  },
  {
    id: "dv-festival-gate",
    name: "De Schorre Festival Gate",
    shortLabel: "Festival",
    category: "entrance",
    /*
      A few tens of metres east of the De Schorre DreamVille Gate, on the campsite
      side of the same bridge. The two gates are the two ends of one crossing, so
      the combined view joins them with a short, real edge rather than pretending
      they occupy one point.
    */
    lng: 4.3873,
    lat: 51.09275,
    summary:
      "The far end of the walkway, where DreamVille meets the festival site; from here the De Schorre map takes over.",
    typicalZoneNote:
      "One-way in practice after the headline set, as the whole campsite walks back at the same time.",
  },
  {
    id: "dv-shuttle",
    name: "DreamVille Shuttle Stop",
    shortLabel: "Shuttle",
    category: "transport",
    lng: 4.3936,
    lat: 51.0936,
    summary:
      "The set-down point for shuttle buses and drop-offs beside Entrance 1, useful for anyone arriving with luggage.",
    typicalZoneNote:
      "Congested on arrival day, when coaches unload faster than the entrance can process them.",
  },
];

const DREAMVILLE_EDGE_SPECS: readonly EdgeSpec[] = [
  { from: "dv-main-entrance", to: "dv-shuttle", peakMultiplier: 1.2, bottleneckNote: "Bag search at Entrance 1 is single file at peak arrival, and the coach park feeds straight into it." },
  { from: "dv-main-entrance", to: "dv-marketplace", peakMultiplier: 1.3, bottleneckNote: "The avenue from Entrance 1 fills as the whole campsite heads out to the festival." },
  { from: "dv-main-entrance", to: "dv-rainbow-walkway", peakMultiplier: 1.3 },
  { from: "dv-main-entrance", to: "dv-montagoe", peakMultiplier: 1.1 },
  { from: "dv-marketplace", to: "dv-easy-tent", peakMultiplier: 1 },
  { from: "dv-marketplace", to: "dv-montagoe", peakMultiplier: 1.1 },
  { from: "dv-marketplace", to: "dv-gathering-stage", peakMultiplier: 1.2, bottleneckNote: "The Gathering crowd spills across the Marketplace aisles on Thursday night." },
  { from: "dv-marketplace", to: "dv-magnificent-greens", peakMultiplier: 1.1 },
  { from: "dv-marketplace", to: "dv-friendship-garden", peakMultiplier: 1.1 },
  { from: "dv-gathering-stage", to: "dv-easy-tent", peakMultiplier: 1 },
  { from: "dv-gathering-stage", to: "dv-magnificent-greens", peakMultiplier: 1 },
  { from: "dv-montagoe", to: "dv-rainbow-walkway", peakMultiplier: 1.2 },
  { from: "dv-rainbow-walkway", to: "dv-festival-gate", peakMultiplier: 1.9, bottleneckNote: "Everyone crosses to De Schorre at the same time; the walkway runs one way in practice after the headline set." },
];

/* -------------------------------------------------------------------------- */
/* DreamVille overlays                                                         */
/* -------------------------------------------------------------------------- */

const DREAMVILLE_BOUNDARY: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3898, 51.0912],
      [4.394, 51.09],
      [4.4, 51.0896],
      [4.405, 51.0908],
      [4.4062, 51.0946],
      [4.403, 51.0972],
      [4.396, 51.0968],
      [4.3912, 51.095],
      [4.389, 51.093],
      [4.3898, 51.0912],
    ],
  ],
};

const DREAMVILLE_MONTAGOE: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3952, 51.0916],
      [4.3982, 51.0914],
      [4.3988, 51.093],
      [4.396, 51.0934],
      [4.3952, 51.0916],
    ],
  ],
};

const DREAMVILLE_EASY_TENT: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3964, 51.0946],
      [4.4004, 51.0945],
      [4.4014, 51.0962],
      [4.3974, 51.0968],
      [4.3964, 51.0946],
    ],
  ],
};

const DREAMVILLE_MARKETPLACE: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3958, 51.0934],
      [4.3992, 51.0934],
      [4.3996, 51.0944],
      [4.3962, 51.0944],
      [4.3958, 51.0934],
    ],
  ],
};

const DREAMVILLE_MAGNIFICENT_GREENS: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.3996, 51.0898],
      [4.4046, 51.09],
      [4.4052, 51.092],
      [4.4004, 51.0926],
      [4.399, 51.0912],
      [4.3996, 51.0898],
    ],
  ],
};

const DREAMVILLE_FRIENDSHIP_GARDEN: GeoJsonPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [4.4016, 51.0946],
      [4.4042, 51.0944],
      [4.405, 51.097],
      [4.4024, 51.0972],
      [4.4016, 51.0946],
    ],
  ],
};

const DREAMVILLE_WALKWAY: GeoJsonLineStringGeometry = {
  type: "LineString",
  coordinates: [
    [4.3918, 51.0929],
    [4.39, 51.0927],
    [4.3884, 51.0923],
    [4.3873, 51.09275],
  ],
};

const DREAMVILLE_SPINE: GeoJsonLineStringGeometry = {
  type: "LineString",
  coordinates: [
    [4.3918, 51.0929],
    [4.3946, 51.0932],
    [4.3975, 51.0941],
    [4.399, 51.0938],
    [4.3985, 51.0952],
  ],
};

const DREAMVILLE_OVERLAYS: GeoJsonFeatureCollection<MapOverlayProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "dreamville-boundary",
      properties: {
        mapId: "dreamville",
        kind: "site-boundary",
        name: "DreamVille site",
        notes: "Indicative extent of the campsite fields; fencing and zone names change from edition to edition.",
      },
      geometry: DREAMVILLE_BOUNDARY,
    },
    {
      type: "Feature",
      id: "dreamville-montagoe",
      properties: {
        mapId: "dreamville",
        kind: "district",
        name: "Montagoe",
        notes: "Boutique accommodation nearest the festival entrance.",
      },
      geometry: DREAMVILLE_MONTAGOE,
    },
    {
      type: "Feature",
      id: "dreamville-easy-tent",
      properties: {
        mapId: "dreamville",
        kind: "district",
        name: "Easy Tent",
        notes: "Pre-pitched tents in the north-central fields.",
      },
      geometry: DREAMVILLE_EASY_TENT,
    },
    {
      type: "Feature",
      id: "dreamville-marketplace",
      properties: {
        mapId: "dreamville",
        kind: "district",
        name: "Marketplace",
        notes: "Shops, bakery, food and the Gathering stage around the central hub.",
      },
      geometry: DREAMVILLE_MARKETPLACE,
    },
    {
      type: "Feature",
      id: "dreamville-magnificent-greens",
      properties: {
        mapId: "dreamville",
        kind: "district",
        name: "Magnificent Greens",
        notes: "General camping on the southern and eastern fields.",
      },
      geometry: DREAMVILLE_MAGNIFICENT_GREENS,
    },
    {
      type: "Feature",
      id: "dreamville-friendship-garden",
      properties: {
        mapId: "dreamville",
        kind: "district",
        name: "Friendship Garden",
        notes: "Group camping in the north-east corner of the site.",
      },
      geometry: DREAMVILLE_FRIENDSHIP_GARDEN,
    },
    {
      type: "Feature",
      id: "dreamville-walkway",
      properties: {
        mapId: "dreamville",
        kind: "walkway",
        name: "Walkway to De Schorre",
        notes: "The signed crossing from the campsite to the festival gate.",
      },
      geometry: DREAMVILLE_WALKWAY,
    },
    {
      type: "Feature",
      id: "dreamville-spine",
      properties: {
        mapId: "dreamville",
        kind: "walking-spine",
        name: "Campsite spine",
        notes: "The main internal route from the walkway, through the Marketplace, to the northern fields.",
      },
      geometry: DREAMVILLE_SPINE,
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* The combined view: De Schorre and DreamVille on one map                      */
/* -------------------------------------------------------------------------- */

/**
 * The De Schorre gate that the two layouts share.
 *
 * On the ground there is one crossing: De Schorre's DreamVille Gate on its own
 * side of the bridge, and DreamVille's festival gate at the far end of the
 * campsite walkway. The two descriptions name the same piece of tarmac, so the
 * combined map draws it once — under the De Schorre id, because that is the side
 * a visitor arrives at first when walking out of the campsite.
 */
export const CROSS_VENUE_NODE_ID = "ds-dreamville-gate";

/**
 * The DreamVille id that stands for the same crossing.
 *
 * Kept as a named constant so the merge below, and any test that checks it,
 * cannot disagree about which node was folded into which.
 */
export const CROSS_VENUE_ALIAS_ID = "dv-festival-gate";

/**
 * The shared crossing, described for a visitor who is looking at both layouts at
 * once. Only the combined map uses this wording; each venue keeps its own.
 */
const CROSS_VENUE_NODE: GeoMapNode = {
  id: CROSS_VENUE_NODE_ID,
  name: "DreamVille Gate and Festival Walkway",
  shortLabel: "DV Gate",
  category: "entrance",
  lng: 4.3868,
  lat: 51.0928,
  summary:
    "The shared crossing between the festival site and the campsite: De Schorre's DreamVille Gate on the festival side, the end of DreamVille's Rainbow Walkway on the other.",
  typicalZoneNote:
    "Effectively one-way after the headline set, as the whole campsite moves east across it at once.",
};

/** Every node of both venues, with the shared crossing drawn once. */
const ALL_VENUE_NODES: readonly GeoMapNode[] = [
  ...DE_SCHORRE_NODES.map((node) => (node.id === CROSS_VENUE_NODE_ID ? CROSS_VENUE_NODE : node)),
  ...DREAMVILLE_NODES.filter((node) => node.id !== CROSS_VENUE_ALIAS_ID),
];

/**
 * DreamVille's footpaths, retargeted at the shared crossing.
 *
 * The DreamVille map keeps `dv-festival-gate`; here the one edge that ended there
 * ends at the merged node instead, so the combined graph is joined without a
 * second, invented link between the two gates.
 */
const ALL_DREAMVILLE_EDGE_SPECS: readonly EdgeSpec[] = DREAMVILLE_EDGE_SPECS.map((spec) => ({
  ...spec,
  from: spec.from === CROSS_VENUE_ALIAS_ID ? CROSS_VENUE_NODE_ID : spec.from,
  to: spec.to === CROSS_VENUE_ALIAS_ID ? CROSS_VENUE_NODE_ID : spec.to,
}));

/** The two venues' overlays side by side, each still tagged with its own map. */
const ALL_VENUE_OVERLAYS: GeoJsonFeatureCollection<MapOverlayProperties> = {
  type: "FeatureCollection",
  features: [...DE_SCHORRE_OVERLAYS.features, ...DREAMVILLE_OVERLAYS.features],
};

/* -------------------------------------------------------------------------- */
/* Assembled maps                                                              */
/* -------------------------------------------------------------------------- */

export const DE_SCHORRE_MAP: GeoMap = {
  id: "de-schorre",
  name: "De Schorre, Boom",
  disclaimer: GEO_DATA_DISCLAIMER,
  centre: [4.3805, 51.0911],
  bounds: { south: 51.0865, west: 4.3716, north: 51.0956, east: 4.3902 },
  nodes: DE_SCHORRE_NODES,
  edges: buildEdges(DE_SCHORRE_NODES, DE_SCHORRE_EDGE_SPECS),
  overlays: DE_SCHORRE_OVERLAYS,
};

export const DREAMVILLE_MAP: GeoMap = {
  id: "dreamville",
  name: "DreamVille, Rumst",
  disclaimer: GEO_DATA_DISCLAIMER,
  centre: [4.3976, 51.0934],
  bounds: { south: 51.0895, west: 4.3862, north: 51.0975, east: 4.407 },
  nodes: DREAMVILLE_NODES,
  edges: buildEdges(DREAMVILLE_NODES, DREAMVILLE_EDGE_SPECS),
  overlays: DREAMVILLE_OVERLAYS,
};

/**
 * Both venues on one map, joined at the shared crossing.
 *
 * This is the view a camper needs: a single walk from a campsite field to a
 * stage, measured end to end rather than as two separate estimates added up by
 * hand. Its bounds are the union of the two venues', so "show the whole site"
 * fits Boom and Rumst in one frame.
 */
export const ALL_VENUE_MAP: GeoMap = {
  id: "all",
  name: "Boom and Rumst, full site",
  disclaimer: GEO_DATA_DISCLAIMER,
  centre: [4.3893, 51.092],
  bounds: { south: 51.0865, west: 4.3716, north: 51.0975, east: 4.407 },
  nodes: ALL_VENUE_NODES,
  edges: [
    ...buildEdges(ALL_VENUE_NODES, DE_SCHORRE_EDGE_SPECS),
    ...buildEdges(ALL_VENUE_NODES, ALL_DREAMVILLE_EDGE_SPECS),
  ],
  overlays: ALL_VENUE_OVERLAYS,
};

/** Every map, keyed so a caller holding a `VenueMapId` can index straight in. */
export const VENUE_MAPS: Readonly<Record<VenueMapId, GeoMap>> = {
  "de-schorre": DE_SCHORRE_MAP,
  dreamville: DREAMVILLE_MAP,
  all: ALL_VENUE_MAP,
};

/**
 * The two physical venues' maps, for anything that stores a favourite or shows
 * one venue at a time. The combined view is deliberately not here.
 */
export const PHYSICAL_VENUE_MAPS: Readonly<Record<PhysicalVenueId, GeoMap>> = {
  "de-schorre": DE_SCHORRE_MAP,
  dreamville: DREAMVILLE_MAP,
};

/**
 * Which of the two venues a node id belongs to, or `null` if it is on neither.
 *
 * The combined view holds nodes from both venues under one id space, so anything
 * that is stored per venue — a favourite, most obviously — needs this to know
 * which bucket a starred zone goes in. A zone starred while viewing the whole
 * site must be the same favourite as one starred on its own venue's map.
 */
export function physicalVenueOfNode(nodeId: string): PhysicalVenueId | null {
  for (const map of [DE_SCHORRE_MAP, DREAMVILLE_MAP]) {
    if (map.nodes.some((node) => node.id === nodeId)) return map.id as PhysicalVenueId;
  }
  return null;
}

/**
 * The window that contains both venues, for the "show everything" button and
 * for guard tests that check nothing has been placed in the North Sea.
 */
export const VENUE_BOUNDS = {
  south: 51.08,
  west: 4.36,
  north: 51.11,
  east: 4.42,
} as const;

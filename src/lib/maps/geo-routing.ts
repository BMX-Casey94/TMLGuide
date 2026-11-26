/**
 * Walking routes between places on the venue maps.
 *
 * The graph is small (a dozen or so nodes per venue) and changes only when the
 * data module is reloaded, so routes are computed on demand with Dijkstra rather
 * than precomputed. A visitor asks for one route at a time and expects an answer
 * before the next frame, which a linear-scan priority queue over this many nodes
 * delivers comfortably.
 *
 * All distances are in miles. Nothing here converts to kilometres, because the
 * guide speaks in miles throughout.
 */

import type {
  GeoBounds,
  GeoJsonLineStringGeometry,
  GeoJsonPosition,
  GeoMap,
  GeoMapEdge,
  GeoMapNode,
  GeoNodeFilter,
  GeoRoute,
} from "./geo-types";

/** Mean Earth radius in miles, the value the Haversine formula is scaled by. */
const EARTH_RADIUS_MILES = 3958.7613;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rounding used for every figure shown to a visitor. Two decimal places of a
 * mile is about thirty metres, which is as precise as a schematic map deserves.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertDegree(value: number, bound: number, label: string): void {
  if (!Number.isFinite(value) || value < -bound || value > bound) {
    throw new RangeError(`${label} must be a finite number between -${bound} and ${bound}`);
  }
}

function assertPosition(position: GeoJsonPosition, label: string): void {
  if (!Array.isArray(position) || position.length !== 2) {
    throw new RangeError(`${label} must be a [lng, lat] pair`);
  }
  const [lng, lat] = position;
  assertDegree(lng, 180, `${label} longitude`);
  assertDegree(lat, 90, `${label} latitude`);
}

/**
 * Great-circle distance between two points, in miles.
 *
 * The Haversine formula is used rather than a flat-earth approximation: the
 * venues span a few hundred metres each, but the same function also measures the
 * distance from a visitor's hotel to the site, where a planar shortcut would
 * drift noticeably at this latitude. Coordinates are `[lng, lat]` in degrees.
 *
 * @throws RangeError when either point is not a valid `[lng, lat]` pair.
 */
export function haversineMiles(a: GeoJsonPosition, b: GeoJsonPosition): number {
  assertPosition(a, "a");
  assertPosition(b, "b");

  const [lngA, latA] = a;
  const [lngB, latB] = b;

  const dLat = (latB - latA) * DEGREES_TO_RADIANS;
  const dLng = (lngB - lngA) * DEGREES_TO_RADIANS;
  const latARad = latA * DEGREES_TO_RADIANS;
  const latBRad = latB * DEGREES_TO_RADIANS;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(latARad) * Math.cos(latBRad) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Indexes a map's nodes by id. Rebuilt per call because maps are tiny. */
function indexNodes(map: GeoMap): ReadonlyMap<string, GeoMapNode> {
  return new Map(map.nodes.map((node) => [node.id, node] as const));
}

/**
 * A route end in the graph: the far node, the edge that reaches it, and the
 * direction-independent data needed to score it.
 */
interface Adjacency {
  readonly neighbourId: string;
  readonly edge: GeoMapEdge;
}

/**
 * Undirected adjacency list. A footpath is walkable both ways, so each edge
 * appears twice: once from `from`, once from `to`. Edges that name an unknown
 * node are dropped rather than trusted, which keeps a malformed data edit from
 * producing a route through a place that does not exist.
 */
function buildAdjacency(map: GeoMap): ReadonlyMap<string, readonly Adjacency[]> {
  const known = new Set(map.nodes.map((node) => node.id));
  const adjacency = new Map<string, Adjacency[]>();

  for (const edge of map.edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) continue;
    if (!(edge.distanceMiles > 0) || !(edge.walkMinutes > 0)) continue;

    const forward = adjacency.get(edge.from);
    if (forward === undefined) adjacency.set(edge.from, [{ neighbourId: edge.to, edge }]);
    else forward.push({ neighbourId: edge.to, edge });

    const backward = adjacency.get(edge.to);
    if (backward === undefined) adjacency.set(edge.to, [{ neighbourId: edge.from, edge }]);
    else backward.push({ neighbourId: edge.from, edge });
  }

  return adjacency;
}

/** A candidate picked out of the priority queue. */
interface QueueEntry {
  readonly nodeId: string;
  /** Cumulative distance in miles: the primary cost. */
  readonly costMiles: number;
  /** Cumulative normal-pace minutes: the first tie-break. */
  readonly costMinutes: number;
  /** Edges walked so far: the second tie-break, preferring the simpler walk. */
  readonly hops: number;
}

/**
 * Orders two candidates cheapest first.
 *
 * Distance is the primary cost because walking minutes are a rounded function of
 * distance, so two different walks can share a minute total while one is clearly
 * shorter. Ordering on the unrounded distance first keeps the route honest, and
 * the remaining keys make the result deterministic: the same query always
 * returns the same path, which matters when a saved route is shared or compared.
 */
function isCheaper(a: QueueEntry, b: QueueEntry): boolean {
  if (a.costMiles !== b.costMiles) return a.costMiles < b.costMiles;
  if (a.costMinutes !== b.costMinutes) return a.costMinutes < b.costMinutes;
  if (a.hops !== b.hops) return a.hops < b.hops;
  return a.nodeId < b.nodeId;
}

/**
 * Returns the cheapest unvisited entry and removes it from the queue.
 *
 * A linear scan is the right call at this size: the whole graph fits in a few
 * cache lines, and a binary heap would add more code than it could save.
 */
function takeCheapest(
  queue: QueueEntry[],
  visited: ReadonlySet<string>,
): QueueEntry | undefined {
  let bestIndex = -1;
  let best: QueueEntry | undefined;

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    if (entry === undefined) continue;
    if (visited.has(entry.nodeId)) continue;
    if (best === undefined || isCheaper(entry, best)) {
      best = entry;
      bestIndex = index;
    }
  }

  if (bestIndex === -1) return undefined;
  const [cheapest] = queue.splice(bestIndex, 1);
  return cheapest;
}

/** The walk leading to a node, walked backwards from the destination. */
interface Predecessor {
  readonly previousId: string;
  readonly edge: GeoMapEdge;
}

/**
 * Finds the shortest walking route between two nodes of one map.
 *
 * Distance is the cost, because a visitor asks which way is shorter and the
 * minute figures are rounded from distance anyway. Peak multipliers are reported
 * alongside rather than used to choose the path: a route that is short but jammed
 * is still the one the signage sends people down, and inventing a detour around
 * a bottleneck would produce directions nobody on site would follow.
 *
 * @returns the route, or `null` when the two nodes sit in different components
 *   of the graph and no walk connects them.
 * @throws RangeError when either id is not a node of `map`.
 */
export function findShortestRoute(map: GeoMap, fromId: string, toId: string): GeoRoute | null {
  const nodesById = indexNodes(map);

  const from = nodesById.get(fromId);
  const to = nodesById.get(toId);
  if (from === undefined) throw new RangeError(`"${fromId}" is not a node of the ${map.id} map`);
  if (to === undefined) throw new RangeError(`"${toId}" is not a node of the ${map.id} map`);

  if (fromId === toId) {
    return {
      mapId: map.id,
      from,
      to,
      nodes: [from],
      edges: [],
      totalDistanceMiles: 0,
      normalWalkMinutes: 0,
      peakWalkMinutes: 0,
      bottleneckNotes: [],
      // A LineString needs two positions, so a zero-length walk repeats its one
      // position rather than emitting geometry the GeoJSON spec rejects.
      geometry: {
        type: "LineString",
        coordinates: [
          [from.lng, from.lat],
          [from.lng, from.lat],
        ],
      },
    };
  }

  const adjacency = buildAdjacency(map);

  /** Cheapest known arrival at each node, keyed by id. */
  const best = new Map<string, QueueEntry>([[fromId, { nodeId: fromId, costMiles: 0, costMinutes: 0, hops: 0 }]]);
  const cameFrom = new Map<string, Predecessor>();
  const visited = new Set<string>();
  const queue: QueueEntry[] = [{ nodeId: fromId, costMiles: 0, costMinutes: 0, hops: 0 }];

  while (queue.length > 0) {
    const current = takeCheapest(queue, visited);
    if (current === undefined) break;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    if (current.nodeId === toId) break;

    for (const link of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(link.neighbourId)) continue;

      const candidate: QueueEntry = {
        nodeId: link.neighbourId,
        costMiles: current.costMiles + link.edge.distanceMiles,
        costMinutes: current.costMinutes + link.edge.walkMinutes,
        hops: current.hops + 1,
      };

      const known = best.get(link.neighbourId);
      if (known !== undefined && !isCheaper(candidate, known)) continue;

      best.set(link.neighbourId, candidate);
      cameFrom.set(link.neighbourId, { previousId: current.nodeId, edge: link.edge });
      queue.push(candidate);
    }
  }

  if (!cameFrom.has(toId)) return null;

  // Walk back from the destination, then reverse, so the arrays read in the
  // order a visitor actually walks them.
  const nodes: GeoMapNode[] = [to];
  const edges: GeoMapEdge[] = [];
  let cursorId = toId;

  while (cursorId !== fromId) {
    const step = cameFrom.get(cursorId);
    if (step === undefined) return null;

    const previous = nodesById.get(step.previousId);
    if (previous === undefined) return null;

    edges.push(step.edge);
    nodes.push(previous);
    cursorId = step.previousId;
  }

  nodes.reverse();
  edges.reverse();

  const totalDistanceMiles = round2(
    edges.reduce((sum, edge) => sum + edge.distanceMiles, 0),
  );
  const normalWalkMinutes = edges.reduce((sum, edge) => sum + edge.walkMinutes, 0);

  // The multiplier inflates the whole edge, and the result is rounded up rather
  // than down: a visitor who is promised eight minutes and takes nine has been
  // misled, while the reverse costs them nothing.
  const peakMinutesExact = edges.reduce(
    (sum, edge) => sum + edge.walkMinutes * Math.max(1, edge.peakMultiplier),
    0,
  );
  const peakWalkMinutes = Math.max(
    normalWalkMinutes,
    Math.ceil(peakMinutesExact - 1e-9),
  );

  const bottleneckNotes: string[] = [];
  for (const edge of edges) {
    const note = edge.bottleneckNote;
    if (note !== undefined && !bottleneckNotes.includes(note)) bottleneckNotes.push(note);
  }

  const geometry: GeoJsonLineStringGeometry = {
    type: "LineString",
    coordinates: nodes.map((node): GeoJsonPosition => [node.lng, node.lat]),
  };

  return {
    mapId: map.id,
    from,
    to,
    nodes,
    edges,
    totalDistanceMiles,
    normalWalkMinutes,
    peakWalkMinutes,
    bottleneckNotes,
    geometry,
  };
}

/**
 * Strips accents and casing so "Schörre", "schorre" and "SCHORRE" are the same
 * word. The combining marks are removed after decomposition, which handles the
 * names a visitor is likely to type with an English keyboard.
 */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** The words of a query, with the blanks a stray double space leaves behind dropped. */
function queryTerms(query: string): readonly string[] {
  return normalise(query).split(/\s+/).filter((term) => term !== "");
}

/** The haystack a search runs against: the name first, then the supporting text. */
function searchableText(node: GeoMapNode): string {
  return normalise(`${node.name} ${node.shortLabel} ${node.summary}`);
}

/**
 * Filters a map's nodes by free text, category and favourites.
 *
 * A query matches when every one of its words appears somewhere in the node's
 * name, short label or summary. Requiring all the words rather than any of them
 * means "rose garden" does not drag in every garden-adjacent result, and it
 * matches what a visitor typing into a search box expects. Results keep the
 * order of `map.nodes`, so the list is stable as the query is edited.
 *
 * @throws RangeError when `map` is not a map with a node list.
 */
export function filterNodes(map: GeoMap, filter: GeoNodeFilter = {}): readonly GeoMapNode[] {
  if (map === null || typeof map !== "object" || !Array.isArray(map.nodes)) {
    throw new RangeError("filterNodes needs a map with a node list");
  }

  const { query, categories, favouritesOnly = false, favouriteIds = [] } = filter;

  const categorySet =
    categories === undefined || categories.length === 0 ? undefined : new Set(categories);
  const favouriteSet = new Set(favouriteIds);
  // A blank query carries no words, so it imposes no text constraint at all.
  // That is what a visitor sees when they open the panel before typing.
  const terms = query === undefined ? [] : queryTerms(query);

  return map.nodes.filter((node) => {
    if (categorySet !== undefined && !categorySet.has(node.category)) return false;
    if (favouritesOnly && !favouriteSet.has(node.id)) return false;
    if (terms.length === 0) return true;

    const haystack = searchableText(node);
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Looks one node up by id, or returns `null`. A convenience for callers holding
 * a deep link or a saved favourite, which need to validate the id before using
 * it as a route endpoint.
 */
export function nodeById(map: GeoMap, id: string): GeoMapNode | null {
  return map.nodes.find((node) => node.id === id) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Cross-venue routing                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The route between two ids, using the first candidate map that connects them.
 *
 * A visitor on the De Schorre view who names a DreamVille camp as the far end
 * cannot be routed on that view: the node is not on it. Rather than refusing,
 * the caller passes its own view first and the combined site map second, and this
 * returns the first walk that exists.
 *
 * Order matters. The caller's own view comes first, so a single-venue walk is
 * still routed on that venue's own graph and keeps exactly the figures that
 * venue's own page has always quoted. The combined map is the fallback for a
 * pair that spans both.
 *
 * @returns the route, or `null` when no candidate holds both ends or when the
 *   two sit in different components of every candidate's graph. A `null` is
 *   shown to the reader as "choose two zones", never as an error. Nothing here
 *   throws for an unknown id; the caller's fallback chain is allowed to run dry.
 */
export function routeBetween(
  candidates: readonly GeoMap[],
  fromId: string,
  toId: string,
): GeoRoute | null {
  for (const map of candidates) {
    if (nodeById(map, fromId) === null) continue;
    if (nodeById(map, toId) === null) continue;
    const route = findShortestRoute(map, fromId, toId);
    if (route !== null) return route;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Position helpers, used by the opt-in "locate me" marker                     */
/* -------------------------------------------------------------------------- */

/** A node and its straight-line distance from a given position. */
export interface NearestNode {
  readonly node: GeoMapNode;
  /** Straight line in miles, unrounded: the caller formats it. */
  readonly straightLineMiles: number;
}

/**
 * The closest node of `map` to `position`, by straight line.
 *
 * Straight line rather than walking distance, because this answers "where am I
 * in relation to the site", which a visitor reads at a glance. The walking
 * planner answers the different question of how long a leg takes.
 *
 * @returns `null` for an empty map, rather than throwing: an empty map is a data
 *   mistake, and the marker is an enhancement that must not break the page.
 * @throws RangeError when `position` is not a valid `[lng, lat]` pair.
 */
export function nearestNode(map: GeoMap, position: GeoJsonPosition): NearestNode | null {
  assertPosition(position, "position");

  let best: NearestNode | null = null;
  for (const node of map.nodes) {
    const miles = haversineMiles(position, [node.lng, node.lat]);
    if (best === null || miles < best.straightLineMiles) {
      best = { node, straightLineMiles: miles };
    }
  }
  return best;
}

/**
 * Straight-line miles from `position` to the nearest edge of a bounding box.
 *
 * Zero when the position is inside the box. Outside it, the nearest point on the
 * box is used, which is the honest answer to "how far outside the site am I":
 * measuring to the centre of the site would tell a visitor standing beside the
 * campsite fence that they were two miles away.
 *
 * The nearest point is found by clamping the longitude and latitude into the
 * box, which is exact in degrees and, at this latitude, within a few metres over
 * the short distances that matter here.
 *
 * @throws RangeError when `position` is not a valid `[lng, lat]` pair.
 */
export function distanceToBoundsMiles(position: GeoJsonPosition, bounds: GeoBounds): number {
  assertPosition(position, "position");

  const [lng, lat] = position;
  const clampedLng = Math.min(Math.max(lng, bounds.west), bounds.east);
  const clampedLat = Math.min(Math.max(lat, bounds.south), bounds.north);

  if (clampedLng === lng && clampedLat === lat) return 0;
  return haversineMiles(position, [clampedLng, clampedLat]);
}

import type { SchematicMapConfig, SchematicMapEdge, SchematicMapNode } from "./maps-data";

export interface WalkEstimate {
  readonly mapId: SchematicMapConfig["id"];
  readonly from: SchematicMapNode;
  readonly to: SchematicMapNode;
  readonly isSameZone: boolean;
  /** Shortest-path sequence of node IDs from start to destination. */
  readonly pathNodeIds: readonly string[];
  /** Edges traversed along the shortest path. */
  readonly edges: readonly SchematicMapEdge[];
  /** Approximate footpath distance in miles, rounded to 2 decimal places. */
  readonly distanceMiles: number;
  /** Estimated normal-flow walking time in whole minutes. */
  readonly normalMinutes: number;
  /** Lower bound of peak changeover walking time in whole minutes. */
  readonly peakMinutesMin: number;
  /** Upper bound of peak changeover walking time in whole minutes. */
  readonly peakMinutesMax: number;
  /** Crowd-surge advisory tailored to the selected route. */
  readonly crowdNote: string;
}

interface Neighbour {
  readonly nodeId: string;
  readonly edge: SchematicMapEdge;
}

function buildAdjacency(config: SchematicMapConfig): Map<string, Neighbour[]> {
  const map = new Map<string, Neighbour[]>();
  for (const node of config.nodes) {
    map.set(node.id, []);
  }
  for (const edge of config.edges) {
    map.get(edge.from)?.push({ nodeId: edge.to, edge });
    map.get(edge.to)?.push({ nodeId: edge.from, edge });
  }
  return map;
}

function roundMiles(miles: number): number {
  return Math.round(miles * 100) / 100;
}

/**
 * Formats a distance in miles using UK English phrasing.
 * Never outputs kilometres.
 */
export function formatMiles(miles: number): string {
  const rounded = roundMiles(miles);
  if (rounded === 0) return "0 miles";
  const formatted = rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${rounded === 1 ? "mile" : "miles"}`;
}

/**
 * Computes the shortest schematic footpath route between two zones on a map
 * using Dijkstra's algorithm weighted by normal walking minutes.
 */
export function estimateWalkRoute(
  config: SchematicMapConfig,
  fromId: string,
  toId: string,
): WalkEstimate | null {
  const nodeById = new Map(config.nodes.map((node) => [node.id, node]));
  const from = nodeById.get(fromId);
  const to = nodeById.get(toId);
  if (!from || !to) return null;

  if (from.id === to.id) {
    return {
      mapId: config.id,
      from,
      to,
      isSameZone: true,
      pathNodeIds: [from.id],
      edges: [],
      distanceMiles: 0,
      normalMinutes: 0,
      peakMinutesMin: 0,
      peakMinutesMax: 0,
      crowdNote:
        "You have selected the same zone as start and destination. Choose two different zones to estimate a walking route.",
    };
  }

  const adjacency = buildAdjacency(config);
  const dist = new Map<string, number>();
  const prev = new Map<string, { nodeId: string; edge: SchematicMapEdge }>();
  const unvisited = new Set<string>(config.nodes.map((n) => n.id));

  for (const node of config.nodes) {
    dist.set(node.id, Number.POSITIVE_INFINITY);
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

    const neighbours = adjacency.get(currentId) ?? [];
    for (const neighbour of neighbours) {
      if (!unvisited.has(neighbour.nodeId)) continue;
      const alt = bestCost + neighbour.edge.walkMinutes;
      if (alt < (dist.get(neighbour.nodeId) ?? Number.POSITIVE_INFINITY)) {
        dist.set(neighbour.nodeId, alt);
        prev.set(neighbour.nodeId, { nodeId: currentId, edge: neighbour.edge });
      }
    }
  }

  if (!prev.has(to.id)) return null;

  const pathNodeIds: string[] = [];
  const edges: SchematicMapEdge[] = [];
  let cursor = to.id;
  while (cursor !== from.id) {
    pathNodeIds.push(cursor);
    const step = prev.get(cursor);
    if (!step) return null;
    edges.push(step.edge);
    cursor = step.nodeId;
  }
  pathNodeIds.push(from.id);
  pathNodeIds.reverse();
  edges.reverse();

  const distanceMiles = roundMiles(edges.reduce((sum, edge) => sum + edge.distanceMiles, 0));
  const normalMinutes = Math.round(edges.reduce((sum, edge) => sum + edge.walkMinutes, 0));
  const weightedPeak = edges.reduce(
    (sum, edge) => sum + edge.walkMinutes * edge.peakMultiplier,
    0,
  );
  const peakMinutesMin = Math.max(normalMinutes + 2, Math.round(weightedPeak * 0.9));
  const peakMinutesMax = Math.max(peakMinutesMin + 2, Math.ceil(weightedPeak * 1.15));

  const bottleneckNotes = edges
    .map((edge) => edge.bottleneckNote)
    .filter((note): note is string => Boolean(note));

  const crowdNote =
    bottleneckNotes.length > 0
      ? bottleneckNotes[0]
      : config.id === "de-schorre"
        ? "Allow extra time during headliner changeovers, when bridges and main walkways can slow to a shuffle."
        : "Allow extra time during midday festival departures and the post-closing walk back into DreamVille.";

  return {
    mapId: config.id,
    from,
    to,
    isSameZone: false,
    pathNodeIds,
    edges,
    distanceMiles,
    normalMinutes,
    peakMinutesMin,
    peakMinutesMax,
    crowdNote,
  };
}

/** Checks whether an undirected edge belongs to the active path. */
export function isEdgeInPath(
  edge: Pick<SchematicMapEdge, "from" | "to">,
  pathNodeIds: readonly string[],
): boolean {
  for (let i = 0; i < pathNodeIds.length - 1; i += 1) {
    const a = pathNodeIds[i];
    const b = pathNodeIds[i + 1];
    if ((edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)) {
      return true;
    }
  }
  return false;
}

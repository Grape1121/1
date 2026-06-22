import { haversineMeters } from "./scoring";
import type { TravelMatrix, TravelMode } from "./providers/googleRoutes";
import type { Place, RouteLeg, RoutePlan, TripContext } from "./types";

// Rough city speeds for estimates when real travel times aren't available.
const SPEED_MPS: Record<TravelMode, number> = {
  WALK: 1.4, // ~5 km/h
  DRIVE: 8.3 // ~30 km/h city driving
};

type Point = { name: string; lat: number; lng: number };

function originPoint(context: TripContext, places: Place[]): Point {
  return {
    name: context.location || "Start",
    lat: context.lat ?? places[0]?.lat ?? 0,
    lng: context.lng ?? places[0]?.lng ?? 0
  };
}

/**
 * Order `n` places to minimise total cost from the origin (an open path).
 * Node indices: 0 = origin, 1..n = place k-1. `cost(i, j)` is the cost of
 * travelling from node i to node j. Places in `pinLast` are forced to the end.
 * Returns place indices (0..n-1) in visit order.
 */
function optimizeOrder(
  n: number,
  pinLast: Set<number>,
  cost: (i: number, j: number) => number
): number[] {
  const free: number[] = [];
  const pinned: number[] = [];
  for (let k = 0; k < n; k++) (pinLast.has(k) ? pinned : free).push(k);

  // Nearest-neighbour over the free stops.
  const visited = new Set<number>();
  const order: number[] = [];
  let current = 0; // origin node
  while (order.length < free.length) {
    let best = -1;
    let bestCost = Infinity;
    for (const k of free) {
      if (visited.has(k)) continue;
      const c = cost(current, k + 1);
      if (c < bestCost) {
        bestCost = c;
        best = k;
      }
    }
    visited.add(best);
    order.push(best);
    current = best + 1;
  }

  // 2-opt refinement.
  const pathCost = (ord: number[]) => {
    let total = 0;
    let prev = 0;
    for (const k of ord) {
      total += cost(prev, k + 1);
      prev = k + 1;
    }
    return total;
  };
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1)
        ];
        if (pathCost(cand) + 1e-6 < pathCost(order)) {
          order.splice(0, order.length, ...cand);
          improved = true;
        }
      }
    }
  }

  return [...order, ...pinned];
}

function pinLastSet(places: Place[], categories: string[] = []): Set<number> {
  const set = new Set<number>();
  places.forEach((p, k) => {
    if (categories.includes(p.category)) set.add(k);
  });
  return set;
}

function buildDirectionsUrl(
  origin: Point,
  ordered: Place[],
  mode: TravelMode
): string {
  if (ordered.length === 0) return "";
  const destination = ordered[ordered.length - 1];
  const waypoints = ordered
    .slice(0, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode === "DRIVE" ? "driving" : "walking"
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface PlanOpts {
  pinLastCategories?: string[];
  mode?: TravelMode;
}

/**
 * Straight-line route plan (no API). Used in mock mode or as a fallback.
 */
export function planRoute(
  context: TripContext,
  places: Place[],
  opts: PlanOpts = {}
): RoutePlan {
  const mode = opts.mode ?? "WALK";
  const origin = originPoint(context, places);
  const nodes: Point[] = [origin, ...places];
  const cost = (i: number, j: number) => haversineMeters(nodes[i], nodes[j]);

  const order = optimizeOrder(
    places.length,
    pinLastSet(places, opts.pinLastCategories),
    cost
  );
  const ordered = order.map((k) => places[k]);

  const legs: RouteLeg[] = [];
  let prev: Point = origin;
  let totalDistanceMeters = 0;
  for (const place of ordered) {
    const distanceMeters = Math.round(haversineMeters(prev, place));
    const durationSeconds = Math.round(distanceMeters / SPEED_MPS[mode]);
    legs.push({ from: prev, to: place, distanceMeters, durationSeconds });
    totalDistanceMeters += distanceMeters;
    prev = place;
  }

  return {
    orderedPlaces: ordered,
    legs,
    totalDistanceMeters,
    totalDurationSeconds: legs.reduce((s, l) => s + l.durationSeconds, 0),
    directionsUrl: buildDirectionsUrl(origin, ordered, mode)
  };
}

/**
 * Route plan using real travel times/distances from the Google Routes API.
 * `matrix` is indexed with 0 = origin and 1..N = `places` in the same order.
 */
export function planRouteWithMatrix(
  context: TripContext,
  places: Place[],
  matrix: TravelMatrix,
  opts: PlanOpts = {}
): RoutePlan {
  const mode = opts.mode ?? "WALK";
  const origin = originPoint(context, places);
  const nodes: Point[] = [origin, ...places];

  const dur = (i: number, j: number) =>
    Number.isFinite(matrix.duration[i]?.[j])
      ? matrix.duration[i][j]
      : haversineMeters(nodes[i], nodes[j]) / SPEED_MPS[mode];
  const dist = (i: number, j: number) =>
    Number.isFinite(matrix.distance[i]?.[j])
      ? matrix.distance[i][j]
      : haversineMeters(nodes[i], nodes[j]);

  const order = optimizeOrder(
    places.length,
    pinLastSet(places, opts.pinLastCategories),
    dur
  );

  const legs: RouteLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let prevNode = 0;
  const ordered: Place[] = [];
  for (const k of order) {
    const node = k + 1;
    const place = places[k];
    ordered.push(place);
    const distanceMeters = Math.round(dist(prevNode, node));
    const durationSeconds = Math.round(dur(prevNode, node));
    legs.push({
      from: prevNode === 0 ? origin : places[order[ordered.length - 2]],
      to: place,
      distanceMeters,
      durationSeconds
    });
    totalDistanceMeters += distanceMeters;
    totalDurationSeconds += durationSeconds;
    prevNode = node;
  }

  return {
    orderedPlaces: ordered,
    legs,
    totalDistanceMeters,
    totalDurationSeconds,
    directionsUrl: buildDirectionsUrl(origin, ordered, mode)
  };
}

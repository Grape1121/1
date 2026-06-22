import { haversineMeters } from "./scoring";
import type { Place, RouteLeg, RoutePlan, TripContext } from "./types";

// Rough average walking/short-drive speed for time estimates (m/s).
// ~3.6 km/h padded for crossings/waits; good enough for "is this route sane".
const TRAVEL_SPEED_MPS = 1.4;

type Point = { name: string; lat: number; lng: number };

function totalPathDistance(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineMeters(points[i], points[i + 1]);
  }
  return total;
}

/** Nearest-neighbour ordering starting from `origin` (open path, no return). */
function nearestNeighbour(origin: Point, places: Place[]): Place[] {
  const remaining = [...places];
  const order: Place[] = [];
  let current: Point = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineMeters(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    order.push(next);
    current = next;
  }
  return order;
}

/** 2-opt refinement to untangle the nearest-neighbour path. */
function twoOpt(origin: Point, order: Place[]): Place[] {
  if (order.length < 3) return order;
  let best = order;
  let improved = true;
  const pathDist = (route: Place[]) => totalPathDistance([origin, ...route]);

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1)
        ];
        if (pathDist(candidate) + 1e-6 < pathDist(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

function buildDirectionsUrl(origin: Point, ordered: Place[]): string {
  if (ordered.length === 0) return "";
  const o = `${origin.lat},${origin.lng}`;
  const destination = ordered[ordered.length - 1];
  const dest = `${destination.lat},${destination.lng}`;
  const waypoints = ordered
    .slice(0, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: o,
    destination: dest
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Order the chosen places into the shortest sensible path from the trip origin
 * and produce per-leg distance/time plus a one-click Google Maps directions URL.
 *
 * If any selected place opts into `pinLast` (e.g. dinner) it is forced to the
 * end so the route still respects meal timing.
 */
export function planRoute(
  context: TripContext,
  places: Place[],
  opts: { pinLastCategories?: string[] } = {}
): RoutePlan {
  const origin: Point = {
    name: context.location || "Start",
    lat: context.lat ?? places[0]?.lat ?? 0,
    lng: context.lng ?? places[0]?.lng ?? 0
  };

  const pinLast = new Set(opts.pinLastCategories ?? []);
  const pinned = places.filter((p) => pinLast.has(p.category));
  const free = places.filter((p) => !pinLast.has(p.category));

  let ordered = twoOpt(origin, nearestNeighbour(origin, free));
  ordered = [...ordered, ...pinned];

  const legs: RouteLeg[] = [];
  let prev: Point = origin;
  let totalDistanceMeters = 0;
  for (const place of ordered) {
    const distanceMeters = Math.round(haversineMeters(prev, place));
    const durationSeconds = Math.round(distanceMeters / TRAVEL_SPEED_MPS);
    legs.push({ from: prev, to: place, distanceMeters, durationSeconds });
    totalDistanceMeters += distanceMeters;
    prev = place;
  }

  return {
    orderedPlaces: ordered,
    legs,
    totalDistanceMeters,
    totalDurationSeconds: Math.round(totalDistanceMeters / TRAVEL_SPEED_MPS),
    directionsUrl: buildDirectionsUrl(origin, ordered)
  };
}

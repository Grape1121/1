import { GOOGLE_MAPS_API_KEY } from "../config";

const ROUTE_MATRIX_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

export type TravelMode = "WALK" | "DRIVE";

export interface TravelMatrix {
  /** nodes: index 0 = origin, 1..N = the places in the given order */
  duration: number[][]; // seconds (Infinity when no route)
  distance: number[][]; // meters (Infinity when no route)
}

type Point = { lat: number; lng: number };

function parseDuration(d: unknown): number {
  // Routes API returns e.g. "153s"
  if (typeof d !== "string") return Infinity;
  const n = parseInt(d.replace("s", ""), 10);
  return Number.isFinite(n) ? n : Infinity;
}

/**
 * Real travel times/distances between every pair of points via the Google
 * Routes API. Returns null on any failure so callers can fall back to the
 * straight-line estimate.
 */
export async function computeTravelMatrix(
  points: Point[],
  mode: TravelMode
): Promise<TravelMatrix | null> {
  if (!GOOGLE_MAPS_API_KEY || points.length < 2) return null;

  const waypoints = points.map((p) => ({
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } }
  }));

  try {
    const res = await fetch(ROUTE_MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,duration,distanceMeters,condition"
      },
      body: JSON.stringify({
        origins: waypoints,
        destinations: waypoints,
        travelMode: mode
      })
    });

    if (!res.ok) {
      console.error("[googleRoutes] error", res.status, await res.text());
      return null;
    }

    const elements: any[] = await res.json();
    const n = points.length;
    const duration: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(Infinity)
    );
    const distance: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(Infinity)
    );

    for (const el of elements) {
      const i = el.originIndex;
      const j = el.destinationIndex;
      if (typeof i !== "number" || typeof j !== "number") continue;
      if (el.condition && el.condition !== "ROUTE_EXISTS") continue;
      duration[i][j] = parseDuration(el.duration);
      distance[i][j] =
        typeof el.distanceMeters === "number" ? el.distanceMeters : Infinity;
    }

    return { duration, distance };
  } catch (err) {
    console.error("[googleRoutes] fetch failed", err);
    return null;
  }
}

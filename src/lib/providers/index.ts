import { DEFAULT_ORIGIN, DEFAULT_RADIUS_METERS, USE_MOCK_DATA } from "../config";
import type { CategoryRequest, Place, TripContext } from "../types";
import { geocode, googleSearch } from "./googlePlaces";
import { mockSearch } from "./mock";

/** Resolve the trip origin coordinates, falling back gracefully. */
export async function resolveOrigin(
  context: TripContext
): Promise<{ lat: number; lng: number }> {
  if (typeof context.lat === "number" && typeof context.lng === "number") {
    return { lat: context.lat, lng: context.lng };
  }
  if (!USE_MOCK_DATA && context.location) {
    try {
      const geo = await geocode(context.location);
      if (geo) return geo;
    } catch {
      // fall through to default
    }
  }
  // Mock mode still honours an explicit "lat,lng" string.
  const m = context.location?.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return DEFAULT_ORIGIN;
}

/**
 * Fetch raw (unscored) candidate places for one category.
 * Uses Google Places when a key is configured, otherwise realistic mock data.
 * Any Google failure degrades to mock so the flow never hard-fails.
 */
export async function fetchCandidates(
  category: CategoryRequest,
  context: TripContext,
  origin: { lat: number; lng: number },
  count: number
): Promise<{ places: Place[]; source: "google" | "mock" }> {
  const radius = context.radiusMeters ?? DEFAULT_RADIUS_METERS;
  if (!USE_MOCK_DATA) {
    try {
      const places = await googleSearch(category, origin, count, radius);
      if (places.length > 0) return { places, source: "google" };
    } catch (err) {
      console.error("[providers] Google failed, falling back to mock:", err);
    }
  }
  return { places: mockSearch(category, origin, Math.max(count, 6)), source: "mock" };
}

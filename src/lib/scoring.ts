import type { Companion, Place, TripContext } from "./types";

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two coordinates in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Weighting knobs — tweak to change how the agent balances things.
const WEIGHTS = {
  rating: 0.55, // how good people say it is (confidence-adjusted)
  popularity: 0.2, // how many people have weighed in
  distance: 0.25 // how close / convenient it is
};

// Prior used for the Bayesian rating average. A 5.0 star place with 2 reviews
// should not beat a 4.6 with 900 reviews — shrink small samples toward the prior.
const PRIOR_MEAN = 3.9;
const PRIOR_WEIGHT = 20;

function bayesianRating(rating: number, count: number): number {
  return (PRIOR_WEIGHT * PRIOR_MEAN + rating * count) / (PRIOR_WEIGHT + count);
}

/**
 * Companion context nudges. Same venue, different vibe depending on who you're
 * with. Returns a small additive adjustment in [-0.1, 0.1].
 */
function companionAdjustment(companions: Companion, place: Place): number {
  const price = place.priceLevel ?? 2;
  const popular = place.reviewCount >= 300;
  switch (companions) {
    case "partner":
      // Date: lean toward nicer / higher-rated, away from dirt-cheap fast food.
      return (price >= 2 ? 0.06 : -0.04) + (place.rating >= 4.5 ? 0.04 : 0);
    case "friends":
      // Group hang: lively / popular spots win.
      return (popular ? 0.07 : -0.02) + (price <= 2 ? 0.02 : 0);
    case "family":
      // Family: comfortable, well-reviewed, not too pricey.
      return (price <= 2 ? 0.05 : -0.03) + (popular ? 0.03 : 0);
    case "solo":
    default:
      return place.rating >= 4.4 ? 0.04 : 0;
  }
}

function normalizeDistance(distanceMeters: number, radiusMeters: number): number {
  // 1 at the origin, decaying to ~0 at the search radius.
  return Math.max(0, 1 - distanceMeters / Math.max(radiusMeters, 1));
}

/**
 * Score and rank places for a single category. Mutates `score` and
 * `distanceMeters` on each place and returns a new array sorted best-first.
 */
export function scorePlaces(
  places: Place[],
  context: TripContext,
  radiusMeters: number
): Place[] {
  const origin = { lat: context.lat ?? 0, lng: context.lng ?? 0 };

  const scored = places.map((p) => {
    const distanceMeters = haversineMeters(origin, { lat: p.lat, lng: p.lng });

    const ratingNorm = bayesianRating(p.rating, p.reviewCount) / 5;
    // log scale so 50 vs 5000 reviews isn't a 100x gap.
    const popularityNorm = Math.min(1, Math.log10(p.reviewCount + 1) / 4);
    const distanceNorm = normalizeDistance(distanceMeters, radiusMeters);

    let score =
      WEIGHTS.rating * ratingNorm +
      WEIGHTS.popularity * popularityNorm +
      WEIGHTS.distance * distanceNorm;

    score += companionAdjustment(context.companions, p);

    return { ...p, distanceMeters, score: Math.round(score * 1000) / 1000 };
  });

  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

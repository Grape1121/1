import { DEFAULT_RADIUS_METERS } from "./config";
import { fetchCandidates, resolveOrigin } from "./providers";
import { planRoute } from "./routing";
import { scorePlaces } from "./scoring";
import type { CategoryRequest, Place, RoutePlan, TripContext } from "./types";

// Categories whose stop should stay at the end of the route (meal timing).
const PIN_LAST = ["dinner", "lunch", "supper"];

export interface CategoryOptions {
  category: CategoryRequest;
  origin: { lat: number; lng: number };
  source: "google" | "mock";
  /** Ranked best-first; the UI paginates these (e.g. 3 per page). */
  options: Place[];
}

/**
 * The core agent step: for one category, gather candidates, score them with the
 * trip context (companions, distance, popularity) and return the ranked list.
 */
export async function getCategoryOptions(
  category: CategoryRequest,
  context: TripContext,
  topN = 9
): Promise<CategoryOptions> {
  const origin = await resolveOrigin(context);
  const ctx: TripContext = { ...context, lat: origin.lat, lng: origin.lng };
  const radius = context.radiusMeters ?? DEFAULT_RADIUS_METERS;

  const { places, source } = await fetchCandidates(category, ctx, origin, topN);
  const ranked = scorePlaces(places, ctx, radius).slice(0, topN);

  return { category, origin, source, options: ranked };
}

/** Final agent step: turn the user's picks into an optimized route. */
export function buildPlan(context: TripContext, selected: Place[]): RoutePlan {
  return planRoute(context, selected, { pinLastCategories: PIN_LAST });
}

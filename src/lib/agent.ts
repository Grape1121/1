import { DEFAULT_RADIUS_METERS, USE_MOCK_DATA } from "./config";
import { hoursLabelForDay, isOpenDuringWindow, timeToMinutes } from "./hours";
import { extractKeywords } from "./keywords";
import { fetchCandidates, resolveOrigin } from "./providers";
import { computeTravelMatrix, TravelMode } from "./providers/googleRoutes";
import { planRoute, planRouteWithMatrix } from "./routing";
import { haversineMeters, scorePlaces } from "./scoring";
import type { CategoryRequest, Place, RoutePlan, TripContext } from "./types";

// Categories whose stop should stay at the end of the route (meal timing).
const PIN_LAST = ["dinner", "lunch", "supper", "brunch"];

// Beyond this max straight-line gap between stops we assume driving, not walking.
const DRIVE_THRESHOLD_METERS = 2500;

function pickTravelMode(origin: { lat: number; lng: number }, places: Place[]): TravelMode {
  const pts = [origin, ...places];
  let maxGap = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      maxGap = Math.max(maxGap, haversineMeters(pts[i], pts[j]));
    }
  }
  return maxGap > DRIVE_THRESHOLD_METERS ? "DRIVE" : "WALK";
}

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

  // Fetch a few extra so we still have enough after the opening-hours filter.
  const fetchCount = Math.max(topN, 15);
  const { places, source } = await fetchCandidates(category, ctx, origin, fetchCount);

  let scored = scorePlaces(places, ctx, radius);

  // Only keep places open during the outing window (when a valid one is given).
  const startMin = timeToMinutes(context.startTime);
  const endMin = timeToMinutes(context.endTime);
  const day = context.dayOfWeek;
  const hasWindow =
    startMin != null && endMin != null && endMin > startMin && typeof day === "number";

  if (hasWindow) {
    scored = scored
      .map((p) => {
        const open = isOpenDuringWindow(p.hoursPeriods, day!, startMin!, endMin!);
        return {
          ...p,
          openDuringWindow: open ?? undefined,
          hoursLabel: hoursLabelForDay(p.hoursPeriods, day!),
          _open: open
        };
      })
      // Drop only places we KNOW are closed; keep open + unknown.
      .filter((p) => p._open !== false)
      .map(({ _open, ...p }) => p);
  }

  const ranked = scored
    .slice(0, topN)
    .map((p) => ({ ...p, keywords: extractKeywords(p.reviews) }));

  return { category, origin, source, options: ranked };
}

/**
 * Final agent step: turn the user's picks into an optimized route. Uses real
 * Google Routes travel times when a key is configured, otherwise a
 * straight-line estimate. Falls back to the estimate on any API failure.
 */
export async function buildPlan(
  context: TripContext,
  selected: Place[]
): Promise<RoutePlan> {
  const origin =
    typeof context.lat === "number" && typeof context.lng === "number"
      ? { lat: context.lat, lng: context.lng }
      : await resolveOrigin(context);
  const ctx: TripContext = { ...context, ...origin };
  const mode = pickTravelMode(origin, selected);

  if (!USE_MOCK_DATA && selected.length > 1) {
    const points = [origin, ...selected.map((p) => ({ lat: p.lat, lng: p.lng }))];
    const matrix = await computeTravelMatrix(points, mode);
    if (matrix) {
      return planRouteWithMatrix(ctx, selected, matrix, {
        pinLastCategories: PIN_LAST,
        mode
      });
    }
  }

  return planRoute(ctx, selected, { pinLastCategories: PIN_LAST, mode });
}

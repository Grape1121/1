// Centralized runtime configuration.

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";

/** True when we should serve realistic fake data instead of calling Google. */
export const USE_MOCK_DATA =
  process.env.USE_MOCK_DATA === "true" || GOOGLE_MAPS_API_KEY.length === 0;

/** Fallback origin used in mock mode when the location can't be parsed. */
export const DEFAULT_ORIGIN = { lat: 37.7749, lng: -122.4194 }; // San Francisco

export const DEFAULT_RADIUS_METERS = 2500;

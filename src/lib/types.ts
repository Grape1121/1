// Core domain types shared by the web app, the API routes and the chatbot.

export type Companion = "solo" | "friends" | "partner" | "family";

export interface TripContext {
  /** Free-text location ("Mission District, SF") or "lat,lng". */
  location: string;
  /** Resolved coordinates (filled in after geocoding). */
  lat?: number;
  lng?: number;
  /** Rough time of the outing, e.g. "afternoon", "evening" or an ISO string. */
  time?: string;
  /** Who the user is going with — biases the ranking. */
  companions: Companion;
  /** Search radius around the location, in meters. */
  radiusMeters?: number;
}

/** One stop the user wants to make, e.g. froyo, coffee, dinner. */
export interface CategoryRequest {
  /** Stable id, e.g. "froyo". */
  key: string;
  /** Human label, e.g. "Froyo". */
  label: string;
  /** What to search for, e.g. "frozen yogurt". */
  query: string;
}

export interface Review {
  author?: string;
  rating?: number;
  text: string;
  relativeTime?: string;
}

export interface Place {
  id: string;
  name: string;
  /** The category key this place was fetched for. */
  category: string;
  rating: number; // 0..5
  reviewCount: number;
  priceLevel?: number; // 0..4
  address?: string;
  lat: number;
  lng: number;
  photoUrl?: string;
  mapsUrl?: string;
  reviews: Review[];
  /** 3-4 keywords distilled from the reviews. */
  keywords?: string[];

  // ---- computed by the scoring step ----
  score?: number;
  /** Straight-line distance from the trip origin, meters. */
  distanceMeters?: number;
}

export interface RouteLeg {
  from: Place | { name: string; lat: number; lng: number };
  to: Place;
  distanceMeters: number;
  /** Estimated travel time in seconds (rough, mode-dependent). */
  durationSeconds: number;
}

export interface RoutePlan {
  orderedPlaces: Place[];
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  /** A google.com/maps/dir URL that opens the whole route. */
  directionsUrl: string;
}

// Core domain types shared by the web app, the API routes and the chatbot.

export type Companion = "solo" | "friends" | "partner" | "family";

export interface TripContext {
  /** Free-text location ("Mission District, SF") or "lat,lng". */
  location: string;
  /** Resolved coordinates (filled in after geocoding). */
  lat?: number;
  lng?: number;
  /** Rough time of the outing, e.g. "afternoon" or an ISO string. */
  time?: string;
  /** Outing window start, "HH:MM" (24h). */
  startTime?: string;
  /** Outing window end, "HH:MM" (24h). */
  endTime?: string;
  /** Day of week for the outing, 0=Sunday..6=Saturday (matches Google). */
  dayOfWeek?: number;
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

export interface KeywordTag {
  word: string;
  sentiment: "positive" | "negative";
}

/** One opening interval. Days 0=Sunday..6=Saturday; close may roll to next day. */
export interface OpeningPeriod {
  openDay: number;
  openMin: number; // minutes from midnight
  closeDay: number;
  closeMin: number;
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
  /** Top sentiment words distilled from the reviews. */
  keywords?: KeywordTag[];
  /** Parsed opening hours, used to filter by the outing window. */
  hoursPeriods?: OpeningPeriod[];
  /** Human label of the opening hours on the outing day, e.g. "8 AM – 10 PM". */
  hoursLabel?: string;
  /** Whether the place is open during the requested window (undefined = unknown). */
  openDuringWindow?: boolean;

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

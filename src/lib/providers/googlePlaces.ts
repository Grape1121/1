import { GOOGLE_MAPS_API_KEY } from "../config";
import type { CategoryRequest, Place, Review } from "../types";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.location",
  "places.googleMapsUri",
  "places.photos",
  "places.reviews"
].join(",");

/** Resolve a free-text location (or "lat,lng") to coordinates. */
export async function geocode(
  location: string
): Promise<{ lat: number; lng: number } | null> {
  const latLng = location.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (latLng) {
    return { lat: parseFloat(latLng[1]), lng: parseFloat(latLng[2]) };
  }
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

function photoUrl(photoName: string | undefined): string | undefined {
  if (!photoName) return undefined;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=600&key=${GOOGLE_MAPS_API_KEY}`;
}

export async function googleSearch(
  category: CategoryRequest,
  origin: { lat: number; lng: number },
  count: number,
  radiusMeters: number
): Promise<Place[]> {
  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify({
      textQuery: category.query,
      maxResultCount: Math.min(20, Math.max(count, 10)),
      locationBias: {
        circle: {
          center: { latitude: origin.lat, longitude: origin.lng },
          radius: radiusMeters
        }
      }
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const places: any[] = data?.places ?? [];

  return places.map((p): Place => {
    const reviews: Review[] = (p.reviews ?? []).slice(0, 3).map((r: any) => ({
      author: r.authorAttribution?.displayName,
      rating: r.rating,
      text: r.text?.text ?? r.originalText?.text ?? "",
      relativeTime: r.relativePublishTimeDescription
    }));

    return {
      id: p.id,
      name: p.displayName?.text ?? "Unknown",
      category: category.key,
      rating: p.rating ?? 0,
      reviewCount: p.userRatingCount ?? 0,
      priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined,
      address: p.formattedAddress,
      lat: p.location?.latitude ?? origin.lat,
      lng: p.location?.longitude ?? origin.lng,
      photoUrl: photoUrl(p.photos?.[0]?.name),
      mapsUrl: p.googleMapsUri,
      reviews
    };
  });
}

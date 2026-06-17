import { DEFAULT_ORIGIN } from "../config";
import type { CategoryRequest, Place, Review } from "../types";

// Curated believable names per common category so demos read naturally.
const NAME_BANK: Record<string, string[]> = {
  froyo: ["Frostbite Yogurt", "Swirl & Co.", "Yogurtland", "Chill Spoon", "Tart & Tang", "Cloud Nine Froyo"],
  coffee: ["Blue Bottle Coffee", "Ritual Coffee", "Sightglass", "Four Barrel", "Andytown", "Réveille Coffee"],
  dinner: ["Nopa", "Zuni Café", "Foreign Cinema", "Lazy Bear", "Rich Table", "State Bird Provisions"],
  bookstore: ["City Lights Books", "Green Apple Books", "Dog Eared Books", "The Booksmith", "Alley Cat Books"],
  bar: ["Trick Dog", "Smuggler's Cove", "True Laurel", "ABV", "Bourbon & Branch"],
  dessert: ["Bi-Rite Creamery", "Humphry Slocombe", "Smitten", "Salt & Straw", "Garden Creamery"]
};

const REVIEW_BANK = [
  "Absolutely loved it — would come back in a heartbeat.",
  "Great spot, a little busy on weekends but worth the wait.",
  "Friendly staff and excellent quality. Highly recommend.",
  "Cozy atmosphere, perfect for hanging out.",
  "Solid choice. The portions were generous and fresh.",
  "Cute place, great for a date or catching up with friends.",
  "Pricey but the experience makes up for it.",
  "Hidden gem. Don't tell too many people!"
];

// Deterministic pseudo-random so results are stable per (seed) within a run.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickNames(category: CategoryRequest): string[] {
  const bank = NAME_BANK[category.key.toLowerCase()];
  if (bank) return bank;
  // Generic fallback for arbitrary categories.
  return Array.from({ length: 6 }, (_, i) => `${category.label} Spot #${i + 1}`);
}

export function mockSearch(
  category: CategoryRequest,
  origin: { lat: number; lng: number },
  count: number
): Place[] {
  const base = origin ?? DEFAULT_ORIGIN;
  const names = pickNames(category);
  const rand = mulberry32(hashStr(category.key));

  return names.slice(0, count).map((name, i): Place => {
    const rating = Math.round((3.8 + rand() * 1.2) * 10) / 10; // 3.8 .. 5.0
    const reviewCount = Math.floor(40 + rand() * 2500);
    const priceLevel = 1 + Math.floor(rand() * 3); // 1..3
    // Scatter within ~1.5km of the origin.
    const lat = base.lat + (rand() - 0.5) * 0.025;
    const lng = base.lng + (rand() - 0.5) * 0.025;

    const reviews: Review[] = Array.from({ length: 3 }, (_, r) => ({
      author: ["Alex", "Sam", "Jordan", "Taylor", "Casey"][(i + r) % 5],
      rating: Math.min(5, Math.round((rating + (rand() - 0.5)) * 10) / 10),
      text: REVIEW_BANK[(hashStr(name) + r) % REVIEW_BANK.length],
      relativeTime: ["a week ago", "a month ago", "2 months ago"][r % 3]
    }));

    return {
      id: `mock-${category.key}-${i}`,
      name,
      category: category.key,
      rating,
      reviewCount,
      priceLevel,
      address: `${100 + i * 37} Demo St, San Francisco, CA`,
      lat,
      lng,
      photoUrl: `https://picsum.photos/seed/${encodeURIComponent(name)}/600/400`,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
      reviews
    };
  });
}

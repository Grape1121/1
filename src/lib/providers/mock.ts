import { DEFAULT_ORIGIN } from "../config";
import type { CategoryRequest, Place, Review } from "../types";

// Curated believable names per common category so demos read naturally.
const NAME_BANK: Record<string, string[]> = {
  breakfast: ["Mama's on Washington", "Plow", "Kitchen Story", "Sweet Maple", "Brenda's", "Eats"],
  brunch: ["Foreign Cinema", "Zazie", "Park Tavern", "The Snug", "Outerlands", "Hilda and Jesse"],
  coffee: ["Blue Bottle Coffee", "Ritual Coffee", "Sightglass", "Four Barrel", "Andytown", "Réveille Coffee"],
  boba: ["Boba Guys", "Wonderful Dessert", "Little Sweet", "Plentea", "Steap Tea Bar", "Sharetea"],
  lunch: ["Tartine Manufactory", "Souvla", "The Bird", "Ace's", "Marufuku Ramen", "El Farolito"],
  froyo: ["Frostbite Yogurt", "Swirl & Co.", "Yogurtland", "Chill Spoon", "Tart & Tang", "Cloud Nine Froyo"],
  icecream: ["Bi-Rite Creamery", "Salt & Straw", "Smitten", "Humphry Slocombe", "Garden Creamery", "Mitchell's"],
  dessert: ["Bi-Rite Creamery", "Humphry Slocombe", "Smitten", "Salt & Straw", "Garden Creamery", "b. Patisserie"],
  bakery: ["Tartine Bakery", "Arsicault", "b. Patisserie", "Jane the Bakery", "Neighbor Bakehouse", "Boudin"],
  bookstore: ["City Lights Books", "Green Apple Books", "Dog Eared Books", "The Booksmith", "Alley Cat Books", "Borderlands"],
  park: ["Dolores Park", "Golden Gate Park", "Alamo Square", "Crissy Field", "Lands End", "Buena Vista Park"],
  museum: ["SFMOMA", "de Young Museum", "Exploratorium", "Asian Art Museum", "Legion of Honor", "Cable Car Museum"],
  gallery: ["Fraenkel Gallery", "Gagosian", "Jenkins Johnson", "Catharine Clark", "Minnesota Street Project", "Et al."],
  shopping: ["Westfield Centre", "Union Square", "Ferry Building", "Hayes Valley Shops", "Valencia St", "Chestnut St"],
  viewpoint: ["Twin Peaks", "Bernal Heights", "Corona Heights", "Tank Hill", "Grandview Park", "Battery Spencer"],
  cinema: ["The Castro Theatre", "Roxie Theater", "Alamo Drafthouse", "AMC Metreon", "Balboa Theatre", "Vogue Theatre"],
  dinner: ["Nopa", "Zuni Café", "Foreign Cinema", "Lazy Bear", "Rich Table", "State Bird Provisions"],
  winebar: ["The Riddler", "Verjus", "Bar Crenn", "Amélie", "Terroir", "20 Spot"],
  bar: ["Trick Dog", "Smuggler's Cove", "True Laurel", "ABV", "Bourbon & Branch", "Comstock Saloon"]
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

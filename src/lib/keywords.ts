import type { KeywordTag, Review } from "./types";

// Sentiment lexicons tuned for restaurant / cafe / shop reviews. We only keep
// words that carry a clear positive or negative feeling, then surface the most
// frequent ones — so cards show "how people feel", not random nouns.

const POSITIVE = new Set([
  "delicious", "tasty", "yummy", "flavorful", "fresh", "amazing", "awesome",
  "great", "good", "best", "excellent", "wonderful", "fantastic", "lovely",
  "perfect", "favorite", "favourite", "love", "loved", "friendly", "attentive",
  "helpful", "welcoming", "cozy", "clean", "cute", "charming", "authentic",
  "generous", "affordable", "reasonable", "quick", "fast", "crispy", "juicy",
  "rich", "creamy", "smooth", "sweet", "warm", "beautiful", "gorgeous", "nice",
  "solid", "recommend", "recommended", "worth", "fun", "relaxing", "chill",
  "quiet", "spacious", "convenient", "consistent", "fluffy", "moist", "tender",
  "kind", "polite", "efficient", "prompt", "vibrant", "incredible",
  "outstanding", "stellar", "superb", "refreshing", "satisfying", "hearty",
  "comforting", "comfortable", "flavour", "flavorful", "delightful", "happy",
  "impressed", "enjoyed", "enjoy", "pleasant", "exceptional", "phenomenal"
]);

const NEGATIVE = new Set([
  "rude", "slow", "dirty", "expensive", "overpriced", "pricey", "bland",
  "tasteless", "cold", "stale", "soggy", "dry", "greasy", "oily", "cramped",
  "crowded", "loud", "noisy", "disappointing", "disappointed", "mediocre",
  "meh", "wrong", "mistake", "rushed", "unfriendly", "inattentive", "ignored",
  "gross", "nasty", "burnt", "undercooked", "overcooked", "watery", "mushy",
  "sketchy", "dingy", "outdated", "limited", "understaffed", "messy", "sticky",
  "smelly", "bad", "worst", "terrible", "horrible", "awful", "poor", "lacking",
  "lackluster", "underwhelming", "costly", "broken", "bummer", "unprofessional",
  "frustrating", "annoying", "tasteless", "flavorless", "stingy", "chaotic"
]);

/**
 * Top sentiment keywords for a place, frequency-ranked, each tagged positive or
 * negative so the UI can colour them green / red.
 */
export function extractKeywords(reviews: Review[], max = 4): KeywordTag[] {
  const counts = new Map<
    string,
    { n: number; sentiment: "positive" | "negative" }
  >();

  for (const r of reviews) {
    const words = (r.text || "").toLowerCase().match(/[a-z'][a-z']{2,}/g) || [];
    for (let w of words) {
      w = w.replace(/'s$/, "").replace(/'$/, "");
      const sentiment: "positive" | "negative" | null = POSITIVE.has(w)
        ? "positive"
        : NEGATIVE.has(w)
          ? "negative"
          : null;
      if (!sentiment) continue;
      const cur = counts.get(w) ?? { n: 0, sentiment };
      cur.n += 1;
      counts.set(w, cur);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, max)
    .map(([w, v]) => ({
      word: w.charAt(0).toUpperCase() + w.slice(1),
      sentiment: v.sentiment
    }));
}

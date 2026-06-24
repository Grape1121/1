import type { KeywordTag, Review } from "./types";

// Sentiment lexicons tuned for restaurant / cafe / shop reviews. We only keep
// words that carry a clear positive or negative feeling, then surface the most
// frequent ones — so cards show "how people feel", not random nouns.

export const POSITIVE = new Set([
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
  "comforting", "comfortable", "delightful", "happy", "impressed", "enjoyed",
  "enjoy", "pleasant", "exceptional", "phenomenal"
]);

// NOTE: words that double as menu items in food reviews are deliberately
// excluded to avoid false alarms — e.g. "dirty" (dirty chai), "cold" (cold
// brew), "dry" (dry martini).
export const NEGATIVE = new Set([
  "rude", "slow", "expensive", "overpriced", "pricey", "bland", "tasteless",
  "stale", "soggy", "greasy", "cramped", "crowded", "loud", "noisy",
  "disappointing", "disappointed", "mediocre", "meh", "rushed", "unfriendly",
  "inattentive", "ignored", "gross", "nasty", "burnt", "undercooked",
  "overcooked", "watery", "mushy", "sketchy", "dingy", "outdated",
  "understaffed", "messy", "smelly", "worst", "terrible", "horrible", "awful",
  "poor", "lacking", "lackluster", "underwhelming", "costly", "broken",
  "unprofessional", "frustrating", "annoying", "flavorless", "stingy", "chaotic"
]);

// If a sentiment word is preceded by one of these, skip it ("not friendly").
const NEGATORS = new Set([
  "not", "no", "never", "isnt", "wasnt", "arent", "werent", "didnt", "dont",
  "doesnt", "wouldnt", "cant", "couldnt", "hardly", "barely", "without",
  "nothing", "lacks", "lacked"
]);

/**
 * Top sentiment keywords for a place, frequency-ranked, each tagged positive or
 * negative so the UI can colour them green / red. Skips negated mentions and
 * food-ambiguous words. Still a heuristic, not true NLP.
 */
export function extractKeywords(reviews: Review[], max = 4): KeywordTag[] {
  const counts = new Map<
    string,
    { n: number; sentiment: "positive" | "negative" }
  >();

  for (const r of reviews) {
    const tokens = (r.text || "").toLowerCase().match(/[a-z][a-z']{2,}/g) || [];
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i].replace(/'s$/, "").replace(/'$/, "");
      const sentiment: "positive" | "negative" | null = POSITIVE.has(w)
        ? "positive"
        : NEGATIVE.has(w)
          ? "negative"
          : null;
      if (!sentiment) continue;

      // Negation check on the previous two tokens.
      const prev = (tokens[i - 1] || "").replace(/'/g, "");
      const prev2 = (tokens[i - 2] || "").replace(/'/g, "");
      if (NEGATORS.has(prev) || NEGATORS.has(prev2)) continue;

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

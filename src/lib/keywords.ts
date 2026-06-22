import type { Review } from "./types";

// Generic filler to drop so keywords surface the dishes / vibe, not "good place".
const STOP = new Set([
  "the", "and", "was", "were", "with", "that", "this", "they", "them", "then",
  "there", "have", "has", "had", "for", "are", "but", "not", "you", "your",
  "our", "out", "get", "got", "its", "really", "very", "just", "also", "too",
  "more", "most", "much", "some", "any", "all", "here", "came", "come", "went",
  "like", "liked", "love", "loved", "nice", "good", "great", "best", "amazing",
  "awesome", "definitely", "would", "could", "will", "can", "one", "two",
  "three", "time", "times", "place", "places", "spot", "food", "order",
  "ordered", "ordering", "try", "tried", "make", "made", "well", "still",
  "back", "when", "what", "who", "how", "why", "which", "because", "about",
  "from", "into", "over", "than", "other", "first", "little", "big", "huge",
  "pretty", "super", "been", "being", "their", "them", "were", "where", "while",
  "down", "want", "wanted", "everything", "something", "anything", "people",
  "place", "around", "after", "before", "again", "even", "only", "also",
  "makes", "make", "tell", "many", "dont", "don't", "perfect", "hanging",
  "going", "gone", "give", "given", "took", "take", "taken", "lot", "lots"
]);

/**
 * Pull 3-4 representative keywords out of a place's reviews — frequency-ranked,
 * stop-word filtered. Total-occurrence counting lets a repeated dish/topic
 * (e.g. "chicken", "lasagna") rise to the top.
 */
export function extractKeywords(reviews: Review[], max = 4): string[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const words = (r.text || "").toLowerCase().match(/[a-z][a-z']{2,}/g) || [];
    for (let w of words) {
      w = w.replace(/'s$/, "").replace(/'$/, "");
      if (w.length < 4 || STOP.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
}

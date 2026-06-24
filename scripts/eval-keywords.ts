/**
 * Offline eval for the review sentiment-keyword extractor.
 *
 * Runs a fixed, human-labelled set of cases (evals/sentiment-cases.json)
 * through both the BASELINE extractor (old: includes food-ambiguous words,
 * no negation handling) and the CURRENT one, and reports two product metrics:
 *
 *   - Misleading-tag rate: of cases that contain a known trap word, how often
 *     a misleading tag leaks through (lower is better).
 *   - Coverage: of cases with expected sentiment, how often we capture it.
 *
 * Fails (exit 1) if the current misleading-tag rate exceeds THRESHOLD, so it
 * can run as a CI quality gate. Run with: npm run eval
 */
import cases from "../evals/sentiment-cases.json";
import { extractKeywords, NEGATIVE, POSITIVE } from "../src/lib/keywords";

const THRESHOLD = 0.1; // max acceptable misleading-tag rate for the current model

type Case = { id: string; text: string; gold: string[]; traps: string[] };

// --- BASELINE (pre-fix) extractor: ambiguous words in, no negation handling ---
const BASE_NEG = new Set([...NEGATIVE, "dirty", "cold", "dry"]);
function baselineWords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z][a-z']{2,}/g) || [];
  const found = new Set<string>();
  for (const t of tokens) {
    const w = t.replace(/'s$/, "").replace(/'$/, "");
    if (POSITIVE.has(w) || BASE_NEG.has(w)) found.add(w);
  }
  return [...found];
}

function currentWords(text: string): string[] {
  return extractKeywords([{ text }], 99).map((k) => k.word.toLowerCase());
}

function evaluate(name: string, wordsOf: (t: string) => string[]) {
  const withTraps = (cases as Case[]).filter((c) => c.traps.length > 0);
  const withGold = (cases as Case[]).filter((c) => c.gold.length > 0);
  const leaks: string[] = [];
  const misses: string[] = [];

  for (const c of cases as Case[]) {
    const words = wordsOf(c.text);
    const leaked = c.traps.filter((t) => words.includes(t));
    if (leaked.length) leaks.push(`${c.id} → leaked [${leaked.join(", ")}]`);
    if (c.gold.length && !c.gold.some((g) => words.includes(g))) {
      misses.push(`${c.id} → missed all of [${c.gold.join(", ")}]`);
    }
  }

  const leakRate = leaks.length / withTraps.length;
  const coverage = (withGold.length - misses.length) / withGold.length;
  return { name, leakRate, coverage, leaks, misses, nTraps: withTraps.length };
}

const base = evaluate("baseline (old)", baselineWords);
const cur = evaluate("current", currentWords);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log(`\nSentiment-keyword eval — ${cases.length} labelled cases\n`);
console.log("metric                 baseline    current");
console.log("─────────────────────  ─────────   ─────────");
console.log(
  `misleading-tag rate    ${pct(base.leakRate).padEnd(9)}   ${pct(cur.leakRate)}` +
    `   (${base.nTraps} trap cases)`
);
console.log(
  `sentiment coverage     ${pct(base.coverage).padEnd(9)}   ${pct(cur.coverage)}`
);

if (cur.leaks.length) {
  console.log("\nCurrent misleading tags still leaking:");
  cur.leaks.forEach((l) => console.log("  • " + l));
}
if (cur.misses.length) {
  console.log("\nCurrent sentiment misses:");
  cur.misses.forEach((m) => console.log("  • " + m));
}

console.log(
  `\nResult: misleading-tag rate ${pct(cur.leakRate)} ` +
    `(threshold ${pct(THRESHOLD)}) — ${cur.leakRate <= THRESHOLD ? "PASS ✅" : "FAIL ❌"}\n`
);
process.exit(cur.leakRate <= THRESHOLD ? 0 : 1);

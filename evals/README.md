# Sentiment-keyword evals

A small, repeatable quality process for the review → keyword feature, modelled
on how AI products keep output quality from silently regressing.

## Why

The card keywords are produced by a heuristic extractor (`src/lib/keywords.ts`).
Heuristics drift: a lexicon tweak that fixes one case can break another
("dirty chai" → a false `Dirty` tag). This eval is the **ruler** we measure
every change against.

## What's here

- **`sentiment-cases.json`** — the **golden set**: human-labelled review
  snippets. Each case lists the sentiment we *should* surface (`gold`) and known
  **trap words** that must *not* appear (`traps`), e.g. food terms (`dirty`,
  `cold`, `dry`) and negated mentions ("not friendly").
- **`../scripts/eval-keywords.ts`** — the runner (`npm run eval`). It scores the
  current extractor against a baseline and reports two product metrics:
  - **Misleading-tag rate** — of trap cases, how often a wrong tag leaks (↓ better).
  - **Sentiment coverage** — of cases with real sentiment, how often we catch it (↑ better).
  It exits non-zero if the misleading-tag rate exceeds the threshold, so it can
  act as a **CI quality gate**.

## How to use it (the flywheel)

1. Change the extractor (or later, swap in an LLM).
2. `npm run eval` — see whether quality went up or down vs the same ruler.
3. **When a bad tag shows up in real usage, add it as a new labelled case** and
   re-run. The golden set grows, the ruler gets stricter, and that failure can
   never silently come back.

## Current result

`npm run eval` → misleading-tag rate **100% → 0%** across 13 trap cases, with
**100%** sentiment coverage retained (24 labelled cases).

## Roadmap

- Periodically **sample real production reviews**, human-label new traps, and
  fold them into `sentiment-cases.json` (needs the Maps API key, so it runs
  where the key lives).
- When the extractor moves to an LLM, keep this exact eval as the regression
  ruler and add accuracy/cost/latency to the report.

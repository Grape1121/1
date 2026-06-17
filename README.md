# Outing Planner

An agent that plans an afternoon/evening out. You tell it the basics — where you
are, when, and who you're with — plus the kinds of stops you want (froyo, coffee,
dinner, bookstore…). For each stop it gathers rated venues, **balances the
ratings with a weighted score**, and shows you the top picks as cards. You flip
through one stop at a time, tap the spot you like, and at the end it stitches
your choices into the **most efficient route**.

```
input (time / place / companions / goals)
        │
        ▼
froyo ──►  [ 3 ranked cards ]  ──► pick
coffee ─►  [ 3 ranked cards ]  ──► pick
dinner ─►  [ 3 ranked cards ]  ──► pick
        │
        ▼
final list  1 → 2 → 3  (optimized route + Google Maps link)
```

## How it works

| Step | Where |
|------|-------|
| Gather candidate venues per category | `src/lib/providers/` (Google Places, with mock fallback) |
| Weighted scoring (rating + popularity + distance + companion bias) | `src/lib/scoring.ts` |
| Paged card selection, one stop per page | `src/app/page.tsx` |
| Route optimization (nearest-neighbour + 2-opt) | `src/lib/routing.ts` |
| Shared orchestration | `src/lib/agent.ts` |

The same core engine (`src/lib/`) is consumed by **two front ends**:

- **Web app** — the card UI in `src/app/` + REST API in `src/app/api/`.
- **Chatbot** — `src/bot/cli.ts`, a chat-style flow that proves a
  Telegram/WeChat/WhatsApp bot only needs to swap the I/O layer.

## Scoring

Each candidate gets:

```
score = 0.55 · ratingNorm      (Bayesian-adjusted, so 5.0/2-reviews ≠ 5.0/2000)
      + 0.20 · popularityNorm   (log-scaled review count)
      + 0.25 · distanceNorm     (closer = better, decays to the search radius)
      + companion nudge         (date → nicer; friends → lively; family → comfy)
```

Tune the weights in `src/lib/scoring.ts`.

## Getting started

```bash
npm install
cp .env.example .env        # optional — leave the key empty to use demo data
npm run dev                 # web app at http://localhost:3000
npm run bot                 # chatbot CLI in the terminal
```

### Real data (Google Places)

1. Create a Google Maps Platform key and enable **Places API (New)** and
   **Geocoding API**.
2. Put it in `.env`:
   ```
   GOOGLE_MAPS_API_KEY=your_key_here
   ```

Without a key (or with `USE_MOCK_DATA=true`) the app runs entirely on realistic
mock data, so the full flow works offline.

## API

`POST /api/candidates` → ranked options for one stop
```json
{ "context": { "location": "Mission District, SF", "companions": "partner" },
  "category": { "key": "coffee", "label": "Coffee", "query": "coffee shop" },
  "topN": 9 }
```

`POST /api/route` → optimized route for the chosen places
```json
{ "context": { "location": "Mission District, SF", "companions": "partner" },
  "places": [ /* Place objects the user selected */ ] }
```

## Roadmap

- Real travel times via the Google Routes/Distance Matrix API (currently
  straight-line estimates).
- Open-now / hours filtering and reservation links.
- Yelp as a second source, blended into the score.
- Natural-language intake ("a chill date this evening near the Mission") parsed
  by an LLM into the `TripContext` + categories.

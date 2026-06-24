/**
 * Lightweight unit tests for the core engine (no test framework — just tsx +
 * node:assert). Run with: npm run test
 */
import assert from "node:assert/strict";
import { haversineMeters, scorePlaces } from "../src/lib/scoring";
import { hoursLabelForDay, isOpenDuringWindow, timeToMinutes } from "../src/lib/hours";
import { planRoute } from "../src/lib/routing";
import { getCategoryOptions } from "../src/lib/agent";
import type { OpeningPeriod, Place, TripContext } from "../src/lib/types";

const results: { name: string; ok: boolean; err?: string }[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e: any) {
    results.push({ name, ok: false, err: e?.message });
  }
}

function place(partial: Partial<Place>): Place {
  return {
    id: "x", name: "X", category: "coffee", rating: 4, reviewCount: 100,
    lat: 0, lng: 0, reviews: [], ...partial
  };
}

async function main() {
await test("haversine ≈ known distance (0.01° lat ≈ 1.11 km)", () => {
  const d = haversineMeters({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7849, lng: -122.4194 });
  assert.ok(Math.abs(d - 1111) < 50, `got ${d}`);
});

await test("timeToMinutes parses and rejects", () => {
  assert.equal(timeToMinutes("14:30"), 870);
  assert.equal(timeToMinutes("bad"), null);
});

await test("isOpenDuringWindow overlap logic", () => {
  const periods: OpeningPeriod[] = [{ openDay: 3, openMin: 420, closeDay: 3, closeMin: 1080 }];
  assert.equal(isOpenDuringWindow(periods, 3, 840, 1020), true); // 2–5pm within 7am–6pm
  assert.equal(isOpenDuringWindow(periods, 3, 1140, 1260), false); // 7–9pm, closed
  assert.equal(isOpenDuringWindow(undefined, 3, 840, 1020), null); // unknown
});

await test("hoursLabelForDay formats nicely", () => {
  const periods: OpeningPeriod[] = [{ openDay: 3, openMin: 420, closeDay: 3, closeMin: 1080 }];
  assert.equal(hoursLabelForDay(periods, 3), "7 AM – 6 PM");
});

await test("scorePlaces ranks higher-rated & closer first", () => {
  const ctx: TripContext = { location: "x", companions: "solo", lat: 0, lng: 0 };
  const a = place({ id: "a", rating: 4.8, reviewCount: 1000, lat: 0.001, lng: 0 });
  const b = place({ id: "b", rating: 3.9, reviewCount: 50, lat: 0.02, lng: 0 });
  assert.equal(scorePlaces([b, a], ctx, 2500)[0].id, "a");
});

await test("planRoute pins dinner last", () => {
  const ctx: TripContext = { location: "x", companions: "solo", lat: 0, lng: 0 };
  const plan = planRoute(
    ctx,
    [
      place({ id: "c", category: "coffee", lat: 0.001, lng: 0 }),
      place({ id: "d", category: "dinner", lat: 0.0005, lng: 0 }),
      place({ id: "f", category: "froyo", lat: 0.002, lng: 0 })
    ],
    { pinLastCategories: ["dinner"] }
  );
  assert.equal(plan.orderedPlaces.length, 3);
  assert.equal(plan.orderedPlaces.at(-1)!.category, "dinner");
});

await test("budget filter drops pricey places (mock)", async () => {
  const ctx: TripContext = { location: "Mission District, SF", companions: "friends", maxPrice: 1 };
  const r = await getCategoryOptions({ key: "dinner", label: "Dinner", query: "dinner" }, ctx, 9);
  assert.ok(r.options.every((p) => p.priceLevel === undefined || p.priceLevel <= 1));
});

await test("results are de-duplicated by name (mock)", async () => {
  const ctx: TripContext = { location: "Mission District, SF", companions: "friends" };
  const r = await getCategoryOptions({ key: "coffee", label: "Coffee", query: "coffee" }, ctx, 9);
  const names = r.options.map((o) => o.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

  results.forEach((r) => console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.err ? ` — ${r.err}` : ""}`));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();

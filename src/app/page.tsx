"use client";

import { useState } from "react";
import type {
  CategoryOptions
} from "@/lib/agent";
import type {
  CategoryRequest,
  Companion,
  Place,
  RoutePlan,
  TripContext
} from "@/lib/types";

// ---- presets ---------------------------------------------------------------

const PRESETS: CategoryRequest[] = [
  { key: "breakfast", label: "Breakfast", query: "breakfast spot" },
  { key: "brunch", label: "Brunch", query: "brunch restaurant" },
  { key: "coffee", label: "Coffee", query: "coffee shop" },
  { key: "boba", label: "Boba tea", query: "bubble tea" },
  { key: "lunch", label: "Lunch", query: "lunch restaurant" },
  { key: "froyo", label: "Froyo", query: "frozen yogurt" },
  { key: "icecream", label: "Ice cream", query: "ice cream shop" },
  { key: "dessert", label: "Dessert", query: "dessert" },
  { key: "bakery", label: "Bakery", query: "bakery" },
  { key: "bookstore", label: "Bookstore", query: "bookstore" },
  { key: "park", label: "Park", query: "park" },
  { key: "museum", label: "Museum", query: "museum" },
  { key: "gallery", label: "Art gallery", query: "art gallery" },
  { key: "shopping", label: "Shopping", query: "shopping mall" },
  { key: "viewpoint", label: "Scenic spot", query: "scenic viewpoint" },
  { key: "cinema", label: "Cinema", query: "movie theater" },
  { key: "dinner", label: "Dinner", query: "dinner restaurant" },
  { key: "winebar", label: "Wine bar", query: "wine bar" },
  { key: "bar", label: "Bar", query: "cocktail bar" }
];

const COMPANIONS: { value: Companion; label: string }[] = [
  { value: "solo", label: "Just me" },
  { value: "friends", label: "Friends" },
  { value: "partner", label: "Partner / date" },
  { value: "family", label: "Family" }
];

const PAGE_SIZE = 3;

type Stage = "setup" | "selecting" | "plan";
type SortPref = "balanced" | "rating" | "distance";

const SORT_OPTIONS: { value: SortPref; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "rating", label: "Top rated" },
  { value: "distance", label: "Closest" }
];

function sortOptions(list: Place[], sort: SortPref): Place[] {
  const a = [...list];
  if (sort === "rating") {
    a.sort((x, y) => y.rating - x.rating || y.reviewCount - x.reviewCount);
  } else if (sort === "distance") {
    a.sort((x, y) => (x.distanceMeters ?? 0) - (y.distanceMeters ?? 0));
  }
  // "balanced" keeps the server's weighted-score order.
  return a;
}

// ---- helpers ---------------------------------------------------------------

function stars(rating: number) {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

// Approximate per-person money brackets mapped from Google's 1–4 price level.
const PRICE_BRACKET: Record<number, string> = {
  1: "$0–15",
  2: "$15–30",
  3: "$30–60",
  4: "$60+"
};

function priceStr(level?: number) {
  return level && level > 0 ? PRICE_BRACKET[level] ?? "" : "";
}

function fmtDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

// Emoji per stop category for a friendlier timeline.
const CATEGORY_EMOJI: Record<string, string> = {
  breakfast: "🥐", brunch: "🍳", coffee: "☕", boba: "🧋", lunch: "🍜",
  froyo: "🍦", icecream: "🍨", dessert: "🍰", bakery: "🥖", bookstore: "📚",
  park: "🌳", museum: "🏛️", gallery: "🖼️", shopping: "🛍️", viewpoint: "🌅",
  cinema: "🎬", dinner: "🍽️", winebar: "🍷", bar: "🍸"
};

// Rough time spent at each kind of stop (minutes) for the schedule estimate.
const DWELL_MIN: Record<string, number> = {
  breakfast: 45, brunch: 60, coffee: 45, boba: 30, lunch: 60, froyo: 30,
  icecream: 30, dessert: 30, bakery: 20, bookstore: 40, park: 45, museum: 75,
  gallery: 45, shopping: 60, viewpoint: 30, cinema: 130, dinner: 90,
  winebar: 75, bar: 75
};

function emojiFor(category: string) {
  return CATEGORY_EMOJI[category] ?? "📍";
}

function dwellFor(category: string) {
  return DWELL_MIN[category] ?? 45;
}

function fmtClock(totalMin: number) {
  const m = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = hh < 12 ? "AM" : "PM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function parseClock(hhmm?: string): number | null {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// ---- page ------------------------------------------------------------------

export default function Home() {
  const [stage, setStage] = useState<Stage>("setup");

  // setup state
  const [location, setLocation] = useState("Mission District, San Francisco");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [companions, setCompanions] = useState<Companion>("partner");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [categories, setCategories] = useState<CategoryRequest[]>(
    ["froyo", "coffee", "dinner"].map(
      (k) => PRESETS.find((p) => p.key === k)!
    )
  );

  // selecting state
  const [stepIndex, setStepIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [optionsByCat, setOptionsByCat] = useState<Record<string, CategoryOptions>>({});
  const [selected, setSelected] = useState<Record<string, Place>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // plan state
  const [plan, setPlan] = useState<RoutePlan | null>(null);

  // per-category sort preference
  const [sortByCat, setSortByCat] = useState<Record<string, SortPref>>({});

  const timeInvalid = !(startTime < endTime);
  const context: TripContext = {
    location,
    companions,
    startTime,
    endTime,
    dayOfWeek: new Date().getDay(),
    ...(maxPrice === "" ? {} : { maxPrice })
  };

  function toggleCategory(c: CategoryRequest) {
    setCategories((prev) =>
      prev.find((p) => p.key === c.key)
        ? prev.filter((p) => p.key !== c.key)
        : [...prev, c]
    );
  }

  async function loadCategory(index: number) {
    const cat = categories[index];
    if (optionsByCat[cat.key]) {
      setPage(0);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, category: cat, topN: 12 })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "request failed");
      const data: CategoryOptions = await res.json();
      setOptionsByCat((prev) => ({ ...prev, [cat.key]: data }));
      setPage(0);
    } catch (e: any) {
      setError(e.message ?? "Failed to load options");
    } finally {
      setLoading(false);
    }
  }

  async function startSelecting() {
    if (categories.length === 0) return;
    setStage("selecting");
    setStepIndex(0);
    await loadCategory(0);
  }

  function pick(place: Place) {
    const cat = categories[stepIndex];
    setSelected((prev) => ({ ...prev, [cat.key]: place }));
  }

  async function nextStep() {
    if (stepIndex < categories.length - 1) {
      const ni = stepIndex + 1;
      setStepIndex(ni);
      await loadCategory(ni);
    } else {
      await finalize();
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      setPage(0);
    } else {
      setStage("setup");
    }
  }

  async function finalize() {
    setLoading(true);
    setError("");
    try {
      const places = categories
        .map((c) => selected[c.key])
        .filter(Boolean) as Place[];
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, places })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "request failed");
      const data: RoutePlan = await res.json();
      setPlan(data);
      setStage("plan");
    } catch (e: any) {
      setError(e.message ?? "Failed to build route");
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStage("setup");
    setStepIndex(0);
    setPage(0);
    setOptionsByCat({});
    setSelected({});
    setPlan(null);
    setError("");
  }

  // ---- render --------------------------------------------------------------

  return (
    <main className="container">
      <h1>Outing Planner</h1>
      <p className="sub">
        Tell me your plan, pick a spot for each stop, and I&apos;ll route the most
        efficient path through them.
      </p>

      {stage === "setup" && (
        <div className="panel">
          <label>Where are you starting / roaming?</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Neighborhood, address, or lat,lng"
          />

          <div className="row">
            <div>
              <label>Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label>End time</label>
              <input
                type="time"
                value={endTime}
                min={startTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {timeInvalid && (
            <div className="error">End time must be after start time.</div>
          )}

          <div className="row">
            <div>
              <label>Who&apos;s coming</label>
              <select
                value={companions}
                onChange={(e) => setCompanions(e.target.value as Companion)}
              >
                {COMPANIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Budget (per person)</label>
              <select
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">Any budget</option>
                <option value="1">Under $15</option>
                <option value="2">Under $30</option>
                <option value="3">Under $60</option>
              </select>
            </div>
          </div>

          <label>Stops you want to make (in order)</label>
          <div className="chips">
            {PRESETS.map((c) => {
              const active = !!categories.find((p) => p.key === c.key);
              return (
                <span
                  key={c.key}
                  className={`chip ${active ? "active" : ""}`}
                  onClick={() => toggleCategory(c)}
                >
                  {active ? "✓ " : "+ "}
                  {c.label}
                </span>
              );
            })}
          </div>

          <button
            className="primary"
            disabled={categories.length === 0 || !location || timeInvalid}
            onClick={startSelecting}
          >
            Find spots for {categories.length} stop
            {categories.length === 1 ? "" : "s"} →
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      )}

      {stage === "selecting" && (
        <SelectingView
          categories={categories}
          stepIndex={stepIndex}
          page={page}
          setPage={setPage}
          options={optionsByCat[categories[stepIndex]?.key]}
          selectedId={selected[categories[stepIndex]?.key]?.id}
          loading={loading}
          error={error}
          sort={sortByCat[categories[stepIndex]?.key] ?? "balanced"}
          onSortChange={(s) => {
            setSortByCat((prev) => ({
              ...prev,
              [categories[stepIndex].key]: s
            }));
            setPage(0);
          }}
          onPick={pick}
          onPrev={prevStep}
          onNext={nextStep}
          isLast={stepIndex === categories.length - 1}
          canAdvance={!!selected[categories[stepIndex]?.key]}
        />
      )}

      {stage === "plan" && plan && (
        <PlanView
          plan={plan}
          startTime={startTime}
          endTime={endTime}
          onRestart={restart}
        />
      )}
    </main>
  );
}

// ---- selecting view --------------------------------------------------------

function SelectingView(props: {
  categories: CategoryRequest[];
  stepIndex: number;
  page: number;
  setPage: (n: number) => void;
  options?: CategoryOptions;
  selectedId?: string;
  loading: boolean;
  error: string;
  sort: SortPref;
  onSortChange: (s: SortPref) => void;
  onPick: (p: Place) => void;
  onPrev: () => void;
  onNext: () => void;
  isLast: boolean;
  canAdvance: boolean;
}) {
  const {
    categories,
    stepIndex,
    page,
    setPage,
    options,
    selectedId,
    loading,
    error,
    sort,
    onSortChange,
    onPick,
    onPrev,
    onNext,
    isLast,
    canAdvance
  } = props;

  const cat = categories[stepIndex];
  const all = sortOptions(options?.options ?? [], sort);
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const slice = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="panel">
      <div className="progress">
        <span className="step">{cat?.label}</span>
        <span className="count">
          stop {stepIndex + 1}/{categories.length}
        </span>
        {options?.source && (
          <span className="source-tag">
            {options.source === "google" ? "live data" : "demo data"}
          </span>
        )}
      </div>

      {loading && <p className="sub">Finding the best {cat?.label} spots…</p>}
      {error && <div className="error">{error}</div>}
      {!loading && all.length === 0 && (
        <p className="sub">
          No {cat?.label} spots are open during your time window. Try widening the
          window, or go back and adjust.
        </p>
      )}

      {all.length > 0 && (
        <div className="segmented">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`seg-btn ${sort === o.value ? "active" : ""}`}
              onClick={() => onSortChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="cards">
        {slice.map((p) => (
          <div
            key={p.id}
            className={`card ${selectedId === p.id ? "selected" : ""}`}
            onClick={() => onPick(p)}
          >
            {p.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="photo" src={p.photoUrl} alt={p.name} />
            )}
            <div className="body">
              <div className="name">
                <span>{p.name}</span>
                {selectedId === p.id && <span className="check">✓</span>}
              </div>
              <div className="meta">
                <span className="star">{stars(p.rating)}</span> {p.rating.toFixed(1)}{" "}
                · {p.reviewCount.toLocaleString()} reviews{" "}
                {priceStr(p.priceLevel) && `· ${priceStr(p.priceLevel)}`}
              </div>
              <div className="meta">
                {p.distanceMeters != null && fmtDistance(Math.round(p.distanceMeters))}{" "}
                away
              </div>
              {p.hoursLabel && (
                <div className="meta">🕒 Open {p.hoursLabel}</div>
              )}
              {p.keywords && p.keywords.length > 0 && (
                <div className="tags">
                  {p.keywords.map((k) => (
                    <span
                      key={k.word}
                      className={`tag ${
                        k.sentiment === "positive" ? "tag-pos" : "tag-neg"
                      }`}
                    >
                      {k.word}
                    </span>
                  ))}
                </div>
              )}
              {p.reviews?.[0]?.text && (
                <div
                  className="review-wrap"
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="review">
                    &ldquo;{p.reviews[0].text}&rdquo;
                    <span className="review-more"> · tap/hover for all</span>
                  </div>
                  <div className="review-pop">
                    {p.reviews.map((r, idx) => (
                      <div key={idx} className="review-pop-item">
                        {(r.author || r.rating) && (
                          <div className="review-pop-head">
                            {r.author ?? "Reviewer"}
                            {r.rating ? ` · ${r.rating}★` : ""}
                            {r.relativeTime ? ` · ${r.relativeTime}` : ""}
                          </div>
                        )}
                        <div>&ldquo;{r.text}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="nav">
          <button
            className="ghost"
            disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
          >
            ← More like these
          </button>
          <span className="page">
            page {page + 1}/{pageCount}
          </span>
          <button
            className="ghost"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          >
            Show others →
          </button>
        </div>
      )}

      <div className="nav">
        <button className="ghost" onClick={onPrev}>
          ← Back
        </button>
        <button className="primary" disabled={!canAdvance} onClick={onNext}>
          {isLast ? "Build my route →" : "Next stop →"}
        </button>
      </div>
    </div>
  );
}

// ---- plan view -------------------------------------------------------------

// A lightweight inline-SVG sketch of the route (no map API needed).
function RouteMap({ plan }: { plan: RoutePlan }) {
  const origin = plan.legs[0]?.from as { lat: number; lng: number } | undefined;
  const stops = plan.orderedPlaces;
  if (!origin || stops.length === 0) return null;

  const nodes = [
    { lat: origin.lat, lng: origin.lng, label: "" },
    ...stops.map((p, i) => ({ lat: p.lat, lng: p.lng, label: String(i + 1) }))
  ];
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const W = 100;
  const H = 60;
  const PAD = 9;
  const rLat = maxLat - minLat || 1;
  const rLng = maxLng - minLng || 1;
  const x = (lng: number) => PAD + ((lng - minLng) / rLng) * (W - 2 * PAD);
  const y = (lat: number) => PAD + ((maxLat - lat) / rLat) * (H - 2 * PAD);
  const pts = nodes.map((n) => ({ px: x(n.lng), py: y(n.lat), label: n.label }));

  return (
    <svg className="route-map" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <polyline className="rm-path" points={pts.map((p) => `${p.px},${p.py}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle className={i === 0 ? "rm-origin" : "rm-stop"} cx={p.px} cy={p.py} r={i === 0 ? 2 : 3.4} />
          {i > 0 && (
            <text className="rm-num" x={p.px} y={p.py + 1.3} textAnchor="middle" fontSize="3.6">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function PlanView({
  plan,
  startTime,
  endTime,
  onRestart
}: {
  plan: RoutePlan;
  startTime: string;
  endTime: string;
  onRestart: () => void;
}) {
  // Build an estimated schedule from the start time, travel legs and dwell time.
  const startMin = parseClock(startTime);
  const endMin = parseClock(endTime);
  let cursor = startMin ?? 0;
  const schedule = plan.orderedPlaces.map((p, i) => {
    cursor += (plan.legs[i]?.durationSeconds ?? 0) / 60; // travel to this stop
    const arrival = cursor;
    cursor += dwellFor(p.category); // time spent here
    return { arrival, leave: cursor };
  });
  const finishMin = cursor;
  const overruns =
    startMin != null && endMin != null && finishMin > endMin;

  return (
    <div className="panel">
      <div className="plan-hero">
        <div className="plan-hero-emoji">🎉</div>
        <div>
          <h2 className="plan-hero-title">Your outing is planned!</h2>
          <div className="stat-chips">
            <span className="stat">📍 {plan.orderedPlaces.length} stops</span>
            <span className="stat">🚶 {fmtDuration(plan.totalDurationSeconds)} travel</span>
            <span className="stat">📏 {fmtDistance(plan.totalDistanceMeters)}</span>
            {startMin != null && (
              <span className="stat">
                🕒 {fmtClock(startMin)} – {fmtClock(finishMin)}
              </span>
            )}
          </div>
        </div>
      </div>

      {overruns && (
        <div className="overrun">
          ⚠️ This plan runs to about {fmtClock(finishMin)}, past your{" "}
          {fmtClock(endMin!)} end time. Drop a stop or start earlier to fit.
        </div>
      )}

      <RouteMap plan={plan} />

      <div className="timeline">
        {plan.orderedPlaces.map((p, i) => (
          <div key={p.id}>
            {i > 0 && plan.legs[i] && (
              <div className="tleg">
                <span className="tleg-line" />
                <span className="tleg-text">
                  {plan.legs[i].distanceMeters > 2000 ? "🚗" : "🚶"}{" "}
                  {fmtDistance(plan.legs[i].distanceMeters)} ·{" "}
                  {fmtDuration(plan.legs[i].durationSeconds)}
                </span>
              </div>
            )}
            <div className="tstop">
              <div className="tstop-avatar">
                <span className="tstop-emoji">{emojiFor(p.category)}</span>
                <span className="tstop-num">{i + 1}</span>
              </div>
              {p.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="tstop-photo" src={p.photoUrl} alt={p.name} />
              )}
              <div className="tstop-body">
                {startMin != null && (
                  <div className="tstop-time">{fmtClock(schedule[i].arrival)}</div>
                )}
                <div className="tstop-name">{p.name}</div>
                <div className="meta">
                  <span className="star">{stars(p.rating)}</span> {p.rating.toFixed(1)}
                  {p.reviewCount ? ` · ${p.reviewCount.toLocaleString()} reviews` : ""}
                </div>
                {p.keywords && p.keywords.length > 0 && (
                  <div className="tags">
                    {p.keywords.map((k) => (
                      <span
                        key={k.word}
                        className={`tag ${
                          k.sentiment === "positive" ? "tag-pos" : "tag-neg"
                        }`}
                      >
                        {k.word}
                      </span>
                    ))}
                  </div>
                )}
                {p.address && <div className="tstop-addr">{p.address}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {plan.directionsUrl && (
        <a
          className="route-cta"
          href={plan.directionsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open full route in Google Maps →
        </a>
      )}

      <div className="nav">
        <button className="ghost" onClick={onRestart}>
          ↺ Plan another outing
        </button>
      </div>
    </div>
  );
}

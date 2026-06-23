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

// ---- helpers ---------------------------------------------------------------

function stars(rating: number) {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

function priceStr(level?: number) {
  return level && level > 0 ? "$".repeat(level) : "";
}

function fmtDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

// ---- page ------------------------------------------------------------------

export default function Home() {
  const [stage, setStage] = useState<Stage>("setup");

  // setup state
  const [location, setLocation] = useState("Mission District, San Francisco");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [companions, setCompanions] = useState<Companion>("partner");
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

  const timeInvalid = !(startTime < endTime);
  const context: TripContext = {
    location,
    companions,
    startTime,
    endTime,
    dayOfWeek: new Date().getDay()
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
        body: JSON.stringify({ context, category: cat, topN: 9 })
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
          onPick={pick}
          onPrev={prevStep}
          onNext={nextStep}
          isLast={stepIndex === categories.length - 1}
          canAdvance={!!selected[categories[stepIndex]?.key]}
        />
      )}

      {stage === "plan" && plan && (
        <PlanView plan={plan} onRestart={restart} />
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
    onPick,
    onPrev,
    onNext,
    isLast,
    canAdvance
  } = props;

  const cat = categories[stepIndex];
  const all = options?.options ?? [];
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
                <div className="review">&ldquo;{p.reviews[0].text}&rdquo;</div>
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

function PlanView({ plan, onRestart }: { plan: RoutePlan; onRestart: () => void }) {
  return (
    <div className="panel">
      <div className="progress">
        <span className="step">Your plan</span>
        <span className="count">
          {plan.orderedPlaces.length} stops · {fmtDuration(plan.totalDurationSeconds)} total travel
        </span>
      </div>

      {plan.orderedPlaces.map((p, i) => (
        <div key={p.id}>
          {i > 0 && plan.legs[i] && (
            <div className="leg">
              ↓ {fmtDistance(plan.legs[i].distanceMeters)} ·{" "}
              {fmtDuration(plan.legs[i].durationSeconds)}
            </div>
          )}
          <div className="plan-stop">
            <div className="badge">{i + 1}</div>
            <div>
              <div className="name">{p.name}</div>
              <div className="meta">
                <span className="star">{stars(p.rating)}</span> {p.rating.toFixed(1)} ·{" "}
                {p.address ?? ""}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="totals">
        Total distance: <strong>{fmtDistance(plan.totalDistanceMeters)}</strong>
      </div>

      {plan.directionsUrl && (
        <a
          className="maps-link"
          href={plan.directionsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open full route in Google Maps →
        </a>
      )}

      <div className="nav">
        <button className="ghost" onClick={onRestart}>
          ↺ Start over
        </button>
      </div>
    </div>
  );
}

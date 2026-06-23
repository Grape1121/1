import type { OpeningPeriod } from "./types";

const WEEK = 7 * 1440;

/** "HH:MM" -> minutes from midnight, or null if malformed. */
export function timeToMinutes(hhmm?: string): number | null {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return min >= 0 && min <= 1440 ? min : null;
}

/** Google Places (New) `regularOpeningHours` -> normalized periods. */
export function parseGooglePeriods(roh: any): OpeningPeriod[] {
  const periods = roh?.periods;
  if (!Array.isArray(periods)) return [];
  const out: OpeningPeriod[] = [];
  for (const p of periods) {
    if (!p?.open) continue;
    const openDay = p.open.day ?? 0;
    const openMin = (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    if (!p.close) {
      // No close => open 24/7 from this point.
      out.push({ openDay, openMin, closeDay: openDay + 7, closeMin: openMin });
    } else {
      out.push({
        openDay,
        openMin,
        closeDay: p.close.day ?? openDay,
        closeMin: (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0)
      });
    }
  }
  return out;
}

/** Absolute minute range [open, close) within the week, handling overnight. */
function absRange(p: OpeningPeriod): [number, number] {
  let open = p.openDay * 1440 + p.openMin;
  let close = p.closeDay * 1440 + p.closeMin;
  if (close <= open) close += WEEK;
  return [open, close];
}

/**
 * Is the place open at any point during the window on `day`?
 * Returns true / false, or null when hours are unknown.
 */
export function isOpenDuringWindow(
  periods: OpeningPeriod[] | undefined,
  day: number,
  startMin: number,
  endMin: number
): boolean | null {
  if (!periods || periods.length === 0) return null;
  const s = day * 1440 + startMin;
  const e = day * 1440 + endMin;
  for (const p of periods) {
    const [o, c] = absRange(p);
    // Check this occurrence plus week wrap-arounds for robustness.
    for (const shift of [-WEEK, 0, WEEK]) {
      if (o + shift < e && c + shift > s) return true;
    }
  }
  return false;
}

function fmt(min: number): string {
  const total = ((min % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const ampm = hh < 12 ? "AM" : "PM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === 0 ? `${h12} ${ampm}` : `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** Friendly opening-hours label for `day`, e.g. "8 AM – 10 PM". */
export function hoursLabelForDay(
  periods: OpeningPeriod[] | undefined,
  day: number
): string | undefined {
  if (!periods || periods.length === 0) return undefined;
  const todays = periods.filter((p) => p.openDay === day);
  if (todays.length === 0) return undefined;
  return todays
    .map((p) => {
      const overnight = p.closeDay !== p.openDay;
      return `${fmt(p.openMin)} – ${fmt(p.closeMin)}${overnight ? " (next day)" : ""}`;
    })
    .join(", ");
}

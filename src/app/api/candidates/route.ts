import { NextRequest, NextResponse } from "next/server";
import { getCategoryOptions } from "@/lib/agent";
import { cacheGet, cacheSet } from "@/lib/cache";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { CategoryRequest, TripContext } from "@/lib/types";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

// POST /api/candidates
// Body: { context: TripContext, category: CategoryRequest, topN?: number }
// Returns ranked options for one category (the web app paginates them 3/page).
export async function POST(req: NextRequest) {
  if (!rateLimit(`cand:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const body = await req.json();
    const context = body?.context as TripContext;
    const category = body?.category as CategoryRequest;
    const topN = typeof body?.topN === "number" ? body.topN : 9;

    if (!context?.location || !category?.query) {
      return NextResponse.json(
        { error: "context.location and category.query are required" },
        { status: 400 }
      );
    }

    // Cache identical queries to avoid repeat Google calls (cost + latency).
    const cacheKey = JSON.stringify({
      c: category.key,
      q: category.query,
      loc: context.location,
      day: context.dayOfWeek,
      s: context.startTime,
      e: context.endTime,
      comp: context.companions,
      price: context.maxPrice,
      topN
    });
    const cached = cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached);

    const result = await getCategoryOptions(category, context, topN);
    cacheSet(cacheKey, result, CACHE_TTL_MS);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/candidates]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

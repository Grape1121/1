import { NextRequest, NextResponse } from "next/server";
import { buildPlan } from "@/lib/agent";
import { resolveOrigin } from "@/lib/providers";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { Place, TripContext } from "@/lib/types";

// POST /api/route
// Body: { context: TripContext, places: Place[] }
// Returns the optimized multi-stop route for the user's chosen places.
export async function POST(req: NextRequest) {
  if (!rateLimit(`route:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const body = await req.json();
    const context = body?.context as TripContext;
    const places = body?.places as Place[];

    if (!context?.location || !Array.isArray(places) || places.length === 0) {
      return NextResponse.json(
        { error: "context.location and a non-empty places array are required" },
        { status: 400 }
      );
    }

    const origin = await resolveOrigin(context);
    const plan = await buildPlan({ ...context, ...origin }, places);
    return NextResponse.json(plan);
  } catch (err) {
    console.error("[/api/route]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

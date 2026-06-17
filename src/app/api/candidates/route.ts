import { NextRequest, NextResponse } from "next/server";
import { getCategoryOptions } from "@/lib/agent";
import type { CategoryRequest, TripContext } from "@/lib/types";

// POST /api/candidates
// Body: { context: TripContext, category: CategoryRequest, topN?: number }
// Returns ranked options for one category (the web app paginates them 3/page).
export async function POST(req: NextRequest) {
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

    const result = await getCategoryOptions(category, context, topN);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/candidates]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

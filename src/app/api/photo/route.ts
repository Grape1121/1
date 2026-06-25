import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_MAPS_API_KEY } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// GET /api/photo?name=places/<id>/photos/<id>
// Streams a Google Places photo server-side so the API key stays hidden from
// the browser. Validates the name to a Places photo resource (prevents SSRF).
const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "bad photo name" }, { status: 400 });
  }
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "no key" }, { status: 404 });
  }
  if (!rateLimit(`photo:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=600&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "photo fetch failed" }, { status: 502 });
  }
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      // Cache in the browser so we don't re-bill the same photo repeatedly.
      "Cache-Control": "public, max-age=86400, immutable"
    }
  });
}

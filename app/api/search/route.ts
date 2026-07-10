import { NextResponse } from "next/server";
import { getJson } from "serpapi";
import { checkRateLimit } from "@/lib/redis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  // Optional: check rate limit based on IP
  const ip = request.headers.get("x-forwarded-for") || "search-api-limit";
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const apiKey = process.env.SERPAPI_KEY || process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SerpAPI key not configured on server" },
      { status: 501 }
    );
  }

  try {
    const json = await getJson({
      engine: "google_shopping",
      q: query,
      location: "India",
      hl: "en",
      gl: "in",
      api_key: apiKey,
      num: 20,
    });

    const results = json["shopping_results"] || [];
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("SerpAPI error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch search results" },
      { status: 500 }
    );
  }
}

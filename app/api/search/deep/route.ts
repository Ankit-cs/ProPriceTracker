import { NextResponse } from "next/server";
import { searchAmazonProducts, ScrapedSearchResult } from "@/lib/amazon-search-scraper";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");
    const minPrice = parseFloat(searchParams.get("minPrice") || "0");
    const maxPrice = parseFloat(searchParams.get("maxPrice") || "1000");
    const steps = parseInt(searchParams.get("steps") || "4"); // Number of segments

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    // Calculate price intervals
    const interval = (maxPrice - minPrice) / steps;
    const searchPromises = [];

    for (let i = 0; i < steps; i++) {
      const currentMin = Math.round(minPrice + (interval * i));
      const currentMax = Math.round(minPrice + (interval * (i + 1)));
      
      // Perform segmented searches
      searchPromises.push(
        searchAmazonProducts(keyword, 10, currentMin, currentMax)
          .catch(e => {
            console.error(`Deep Search segment ${currentMin}-${currentMax} failed:`, e);
            return [] as ScrapedSearchResult[];
          })
      );
    }

    const resultsArray = await Promise.all(searchPromises);
    
    // Flatten and deduplicate results
    const allResults = resultsArray.flat();
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.amazonId || item.url, item])).values()
    );

    // Sort by price (ascending)
    uniqueResults.sort((a, b) => a.currentPrice - b.currentPrice);

    return NextResponse.json({
      success: true,
      segmentsSearched: steps,
      totalFound: uniqueResults.length,
      results: uniqueResults
    });
  } catch (error: any) {
    console.error("Deep search API error:", error);
    return NextResponse.json({ error: error.message || "Failed to perform deep search" }, { status: 500 });
  }
}

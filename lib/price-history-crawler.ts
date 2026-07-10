import { getJson } from "serpapi";

export async function fetchPriceHistorySlug(productName: string): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY || process.env.API_KEY;
  if (!apiKey) return null;

  try {
    const query = productName
      .split(" ")
      .slice(0, 7)
      .join(" ")
      .replace(/[,|]/g, "")
      .trim();

    const searchTerm = `${query} site:pricehistoryapp.com`;
    console.log(`[SerpAPI] Searching for PriceHistoryApp link: "${searchTerm}"`);

    const result = await getJson("google", {
      api_key: apiKey,
      q: searchTerm,
    });

    const organicResults = result.organic_results || [];
    if (organicResults.length > 0) {
      const link = organicResults[0].link;
      if (link && link.includes("pricehistoryapp.com/product/")) {
        // Extract the slug (e.g. "product/sony-wh-1000xm4-wireless-noise-cancelling-headphones")
        const parts = link.split("/");
        const slug = parts.length > 4 ? parts.slice(4).join("/") : "";
        return slug;
      }
    }
  } catch (error) {
    console.error("Error searching PriceHistoryApp slug:", error);
  }
  return null;
}

export async function getEnhancedPriceData(slug: string) {
  try {
    const priceHistoryUrl = `https://pricehistoryapp.com/product/${slug}`;
    const response = await fetch(priceHistoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();

    let currentPrice = 0;
    let lowestPrice = 0;
    let highestPrice = 0;
    let averagePrice = 0;
    let discount = 0;
    let dropChances = 0;
    let rating = 0;
    let reviewsCount = 0;
    let priceHistory: { date: string; price: number }[] = [];

    // Attempt 1: Parse via Regex (handles escaped characters inside Next.js RSC push format)
    const historyMatch = html.match(/priceHistory\\*"\s*:\s*\\*\[([\s\S]*?)\\*\]/);
    const dealMatch = html.match(/deal\\*"\s*:\s*\\*\{([\s\S]*?)\\*\}/);

    if (historyMatch) {
      try {
        const cleanHistoryStr = "[" + historyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') + "]";
        priceHistory = JSON.parse(cleanHistoryStr);
      } catch (e) {
        console.error("Regex priceHistory parsing failed:", e);
      }
    }

    if (dealMatch) {
      try {
        const cleanDealStr = "{" + dealMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') + "}";
        const deal = JSON.parse(cleanDealStr);
        currentPrice = parseFloat(deal.price?.replace(/[^\d.]/g, "")) || 0;
        lowestPrice = parseFloat(deal.lowest?.replace(/[^\d.]/g, "")) || parseFloat(deal.original?.replace(/[^\d.]/g, "")) || 0;
        highestPrice = parseFloat(deal.highest?.replace(/[^\d.]/g, "")) || parseFloat(deal.original?.replace(/[^\d.]/g, "")) || 0;
        discount = parseFloat(deal.discount) || 0;
        rating = parseFloat(deal.rating) || 0;
        reviewsCount = parseInt(deal.ratingCount) || 0;
      } catch (e) {
        console.error("Regex deal metadata parsing failed:", e);
      }
    }

    // Calculate aggregates from history if deal object was missing/incomplete
    if (priceHistory.length > 0) {
      const prices = priceHistory.map(p => p.price).filter(p => !isNaN(p) && p > 0);
      if (prices.length > 0) {
        if (!lowestPrice || lowestPrice === 0) lowestPrice = Math.min(...prices);
        if (!highestPrice || highestPrice === 0) highestPrice = Math.max(...prices);
        averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        if (!currentPrice || currentPrice === 0) currentPrice = prices[prices.length - 1];
      }
    }

    // Attempt 2: Fallback to old __NEXT_DATA__
    if (!historyMatch && !dealMatch) {
      const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]*)<\/script>/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        const productData = jsonData.props.pageProps.ogProduct;
        if (productData) {
          currentPrice = parseFloat(productData.price) || 0;
          lowestPrice = parseFloat(productData.lowest_price) || 0;
          highestPrice = parseFloat(productData.highest_price) || 0;
          averagePrice = parseFloat(productData.average_price) || 0;
          discount = parseFloat(productData.discount) || 0;
          dropChances = parseFloat(productData.drop_chances) || 0;
          rating = parseFloat(productData.rating) || 0;
          reviewsCount = parseInt(productData.rating_count) || 0;
          priceHistory = productData.priceHistory || [];
        }
      }
    }

    return {
      currentPrice,
      lowestPrice,
      highestPrice,
      averagePrice,
      discount,
      dropChances,
      rating,
      reviewsCount,
      priceHistory,
    };
  } catch (error) {
    console.error("Error fetching enhanced price data from PriceHistoryApp:", error);
    return null;
  }
}

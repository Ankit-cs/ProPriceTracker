import * as cheerio from "cheerio";
import promiseRetry from "promise-retry";
import ScrapingAntClient from "@scrapingant/scrapingant-client";

export interface ScrapedSearchResult {
  amazonId: string;
  title: string;
  thumbnail: string;
  highResImage: string;
  url: string;
  currentPrice: number;
  originalPrice: number;
  isDiscounted: boolean;
  savings: number;
  rating: number;
  reviewsCount: number;
  isAmazonChoice: boolean;
  isSponsored: boolean;
}

function cleanPriceString(priceText: string): string {
  let cleaned = priceText.replace(/[^\d.,\s-]/g, "").trim();
  cleaned = cleaned.replace(/\s+/g, "");

  if (!cleaned) return "";

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const commaIndex = cleaned.indexOf(",");
    const dotIndex = cleaned.indexOf(".");
    if (commaIndex < dotIndex) {
      return cleaned.replace(/,/g, "");
    } else {
      return cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  }

  if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 3) {
      return cleaned.replace(/,/g, "");
    } else {
      return cleaned.replace(/,/g, ".");
    }
  }

  return cleaned;
}

export async function searchAmazonProducts(keyword: string, limit = 10, minPrice?: number, maxPrice?: number): Promise<ScrapedSearchResult[]> {
  if (!keyword) throw new Error("No keyword provided");

  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGANT_API_KEY is not defined in environment variables");

  const client = new ScrapingAntClient({ apiKey });
  const encodedKeyword = encodeURIComponent(keyword);
  let searchUrl = `https://www.amazon.in/s?k=${encodedKeyword}`;

  if (minPrice !== undefined || maxPrice !== undefined) {
    const minStr = minPrice ? minPrice * 100 : "";
    const maxStr = maxPrice ? maxPrice * 100 : "";
    searchUrl += `&rh=p_36%3A${minStr}-${maxStr}`;
  }


  return promiseRetry(
    async (retry, attempt) => {
      try {
        console.log(`[Amazon Search Scraper] Attempt ${attempt} for keyword: "${keyword}"`);
        
        const response = await client.scrape(searchUrl, { proxy_country: "in" });
        const cleanHtml = response.content.replace(/\s\s+/g, "").replace(/\n/g, "");
        const $ = cheerio.load(cleanHtml);

        const productList = $("div[data-index]");
        const results: ScrapedSearchResult[] = [];

        productList.each((_, el) => {
          if (results.length >= limit) return false;

          const element = $(el);
          const asin = element.attr("data-asin");
          if (!asin) return; // Skip containers without ASIN (e.g. ads/banners)

          // 1. Title & Image Selectors with Fallbacks
          let title = "";
          let thumbnail = "";

          const densitySearch = element.find("[data-image-source-density='1']");
          if (densitySearch.length > 0) {
            title = densitySearch.attr("alt") || "";
            thumbnail = densitySearch.attr("src") || "";
          }

          if (!title) {
            title = element.find("h2 a span").text().trim() || 
                    element.find(".a-size-base-plus.a-color-base.a-text-normal").text().trim() || "";
          }

          if (!thumbnail) {
            thumbnail = element.find("img.s-image").attr("src") || "";
          }

          if (!title) return; // Skip if we can't get a title

          const highResImage = thumbnail ? (thumbnail.split("._")[0] + ".jpg") : "";

          // 2. Price Selectors with Fallbacks
          const priceWhole = element.find(".a-price span.a-offscreen").first().text().trim() || 
                             element.find("span[data-a-size='l']").first().text().trim() || 
                             element.find("span[data-a-size='m']").first().text().trim() ||
                             element.find(".a-color-price").first().text().trim();
          
          const currentPriceClean = cleanPriceString(priceWhole);
          const currentPrice = currentPriceClean ? Number(currentPriceClean) : 0;

          // 3. Discount & Original Price
          const discountWhole = element.find("span.a-price.a-text-price span.a-offscreen").first().text().trim() || 
                               element.find("span[data-a-strike='true']").first().text().trim();
          
          const originalPriceClean = cleanPriceString(discountWhole);
          const originalPrice = originalPriceClean ? Number(originalPriceClean) : currentPrice;

          const isDiscounted = originalPrice > currentPrice && currentPrice > 0;
          const savings = isDiscounted ? (originalPrice - currentPrice) : 0;

          // 4. Rating & Reviews
          let rating = 0;
          let reviewsCount = 0;

          const ratingText = element.find(".a-icon-star-small span.a-icon-alt").first().text().trim() || 
                             element.find(".a-icon-star span.a-icon-alt").first().text().trim() || 
                             element.find("i.a-icon-star span").first().text().trim();
          if (ratingText) {
            const parsedRating = parseFloat(ratingText.split(" out")[0]);
            if (!isNaN(parsedRating)) rating = parsedRating;
          }

          const reviewsText = element.find("span[aria-label*='ratings']").first().attr("aria-label") ||
                              element.find(".a-size-base.s-underline-text").first().text().trim();
          if (reviewsText) {
            const cleanReviews = reviewsText.replace(/[^\d]/g, "");
            if (cleanReviews) reviewsCount = parseInt(cleanReviews);
          }

          // 5. Badges & Sponsorship
          const isAmazonChoice = element.find("span[id*='amazons-choice']").length > 0 || 
                                 element.find(".ac-badge-wrapper").length > 0;
          
          const isSponsored = element.find(".s-sponsored-label-text").length > 0 || 
                              element.find(".a-link-normal").first().attr("href")?.includes("/gp/") || false;

          // 6. Link URL
          let path = element.find("h2 a.a-link-normal").attr("href") || 
                     element.find("a.a-link-normal").attr("href") || "";
          if (path.startsWith("/")) {
            path = `https://www.amazon.in${path}`;
          }

          results.push({
            amazonId: asin,
            title,
            thumbnail,
            highResImage,
            url: path,
            currentPrice,
            originalPrice,
            isDiscounted,
            savings,
            rating,
            reviewsCount,
            isAmazonChoice,
            isSponsored
          });
        });

        if (results.length === 0) {
          throw new Error("No products parsed from search results. Possibly blocked or empty page.");
        }

        return results;
      } catch (error: any) {
        console.error(`[Amazon Search Scraper] Failed attempt ${attempt}:`, error.message);
        retry(error);
      }
    },
    { retries: 3, factor: 2, minTimeout: 2000 }
  );
}

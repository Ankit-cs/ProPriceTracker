import * as cheerio from "cheerio";
import promiseRetry from "promise-retry";
import ScrapingAntClient from "@scrapingant/scrapingant-client";

export interface ScrapedProduct {
  productName: string;
  currentPrice: number;
  currency: string;
  productImageUrl: string;
  originalPrice?: number;
  isDiscounted?: boolean;
  savings?: number;
  amazonId?: string;
  rating?: number;
  reviewsCount?: number;
  isAmazonChoice?: boolean;
  shortDescription?: string;
  fullDescription?: string;
}

// Simple helpers to clean up prices
function extractPrice(...elements: any[]) {
  for (const element of elements) {
    const priceText = element.text().trim();
    if (priceText) {
      const cleanPrice = priceText.replace(/[^\d.]/g, "");
      if (cleanPrice) return cleanPrice;
    }
  }
  return "";
}

function extractCurrency(element: any) {
  const currencyText = element.text().trim().slice(0, 1);
  return currencyText ? currencyText : "";
}

export async function scrapeAmazonProduct(url: string): Promise<ScrapedProduct> {
  if (!url) throw new Error("No URL provided");

  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGANT_API_KEY is not defined in environment variables");

  const client = new ScrapingAntClient({ apiKey });

  // Use the correct country code based on the domain to ensure correct localization
  let countryCode = "us";
  if (url.includes("amazon.in")) countryCode = "in";
  else if (url.includes("amazon.co.uk")) countryCode = "uk";
  else if (url.includes("amazon.fr")) countryCode = "fr";
  else if (url.includes("amazon.de")) countryCode = "de";

  // Implement the robust retry logic found in amazon_scraper
  return promiseRetry(
    async (retry, attempt) => {
      try {
        console.log(`[Amazon Scraper] Attempt ${attempt} for ${url} (Country: ${countryCode})`);
        
        // Let ScrapingAnt handle headless rendering, captchas, and proxies
        const response = await client.scrape(url, { proxy_country: countryCode });
        
        // Clean the DOM aggressively like amazon_scraper does
        const cleanHtml = response.content.replace(/\s\s+/g, "").replace(/\n/g, "");
        const $ = cheerio.load(cleanHtml);

        const title = $("#productTitle").text().trim();
        const currentPriceStr = extractPrice(
          $(".priceToPay span.a-price-whole"),
          $(".a-size-base.a-color-price"),
          $(".a-button-selected .a-color-base")
        );
        const originalPriceStr = extractPrice(
          $("#priceblock_ourprice"),
          $(".a-price.a-text-price span.a-offscreen"),
          $("#listPrice"),
          $("#priceblock_dealprice"),
          $(".a-size-base.a-color-price")
        );
        const originalPrice = originalPriceStr ? Number(originalPriceStr) : 0;
        const currentPrice = currentPriceStr ? Number(currentPriceStr) : originalPrice;
        
        const finalPrice = currentPrice || originalPrice;
        const isDiscounted = originalPrice > finalPrice;
        const savings = isDiscounted ? (originalPrice - finalPrice) : 0;

        const amazonId = $("#ASIN").val() as string || url.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || "";
        
        let rating = 0;
        let reviewsCount = 0;
        const ratingText = $("#acrPopover").attr("title");
        if (ratingText) {
          rating = parseFloat(ratingText.split(" out")[0]);
        }
        const reviewsText = $("#acrCustomerReviewText").text().trim().replace(/,/g, "");
        if (reviewsText) {
          reviewsCount = parseInt(reviewsText.split(" ")[0]);
        }

        const isAmazonChoice = $("span[id*='amazons-choice']").length > 0 || $(".ac-badge-wrapper").length > 0;

        const shortDescription = $("#featurebullets_feature_div").text().trim().replace(/\s+/g, ' ');
        const fullDescription = $("#productDescription").text().trim().replace(/\s+/g, ' ');

        const images =
          $("#imgBlkFront").attr("data-a-dynamic-image") ||
          $("#landingImage").attr("data-a-dynamic-image") ||
          "{}";
        const imageUrls = Object.keys(JSON.parse(images));
        
        // High res image trick as seen in amazon_scraper
        const thumbnail = imageUrls[0] || "";
        const highResImage = thumbnail ? (thumbnail.split("._")[0] + ".jpg") : "";

        let currency = extractCurrency($(".a-price-symbol"));
        if (!currency) currency = "$";

        if (!title || !finalPrice) {
          throw new Error("Missing price or title, possibly blocked by CAPTCHA");
        }

        return {
          productName: title,
          currentPrice: finalPrice,
          currency: currency,
          productImageUrl: highResImage || thumbnail,
          originalPrice: originalPrice,
          isDiscounted,
          savings,
          amazonId,
          rating,
          reviewsCount,
          isAmazonChoice,
          shortDescription,
          fullDescription
        };
      } catch (error: any) {
        console.error(`[Amazon Scraper] Failed attempt ${attempt}:`, error.message);
        retry(error);
      }
    },
    { retries: 3, factor: 2, minTimeout: 2000 }
  );
}

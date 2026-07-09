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

function cleanPriceString(priceText: string): string {
  // Remove currency symbols and other non-numeric/non-separator characters
  let cleaned = priceText.replace(/[^\d.,\s-]/g, "").trim();
  
  // Remove whitespace
  cleaned = cleaned.replace(/\s+/g, "");

  if (!cleaned) return "";

  // Identify decimal separators:
  // If there's a dot and a comma, comma is thousand separator and dot is decimal (or vice versa)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const commaIndex = cleaned.indexOf(",");
    const dotIndex = cleaned.indexOf(".");
    if (commaIndex < dotIndex) {
      // "1,249.99" -> dot is decimal
      return cleaned.replace(/,/g, "");
    } else {
      // "1.249,99" -> comma is decimal
      return cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  }

  // If there's only a comma
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    // If the part after comma is exactly 3 digits, it could be a thousand separator (e.g. 1,000)
    if (parts[parts.length - 1].length === 3) {
      return cleaned.replace(/,/g, "");
    } else {
      return cleaned.replace(/,/g, ".");
    }
  }

  return cleaned;
}

// Simple helpers to clean up prices
function extractPrice(...elements: any[]) {
  for (const element of elements) {
    const priceText = element.text().trim();
    if (priceText) {
      const cleanPrice = cleanPriceString(priceText);
      if (cleanPrice && !isNaN(Number(cleanPrice))) return cleanPrice;
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

  // Set proxy country to India only
  const countryCode = "in";

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

        const title = $("#productTitle").text().trim() || 
                      $("#title").text().trim() || 
                      $(".a-size-large.product-title-word-break").text().trim() || "";
        const currentPriceStr = extractPrice(
          $("#corePriceDisplay_desktop_feature_div .a-price span.a-offscreen"),
          $("#corePrice_desktop .a-price span.a-offscreen"),
          $("#corePrice_feature_div .a-price span.a-offscreen"),
          $(".priceToPay span.a-offscreen"),
          $(".apexPriceToPay span.a-offscreen"),
          $("#price_inside_buybox"),
          $("#newBuyBoxPrice"),
          $(".priceToPay span.a-price-whole"),
          $(".a-size-base.a-color-price"),
          $(".a-button-selected .a-color-base"),
          $("#priceblock_ourprice"),
          $("#priceblock_dealprice")
        );
        const originalPriceStr = extractPrice(
          $(".a-price.a-text-price span.a-offscreen"),
          $("#listPrice"),
          $("#priceblock_ourprice"),
          $("#priceblock_dealprice"),
          $(".a-size-base.a-color-price")
        );
        const originalPrice = originalPriceStr ? Number(originalPriceStr) : 0;
        const currentPrice = currentPriceStr ? Number(currentPriceStr) : originalPrice;
        
        const finalPrice = currentPrice || originalPrice;
        const isDiscounted = originalPrice > finalPrice && finalPrice > 0;
        const savings = isDiscounted ? (originalPrice - finalPrice) : 0;

        const amazonId = $("#ASIN").val() as string || url.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || "";
        
        let rating = 0;
        let reviewsCount = 0;
        
        const ratingText = $("#acrPopover").attr("title") || 
                           $("[data-hook='rating-out-of-five']").text().trim() || 
                           $("i.a-icon-star span.a-icon-alt").text().trim() || 
                           $(".a-icon-star-small .a-icon-alt").text().trim();
        if (ratingText) {
          const match = ratingText.match(/(\d+\.?\d*)\s*(out of|von|sur|de)/i);
          if (match) {
            rating = parseFloat(match[1]);
          } else {
            const parsed = parseFloat(ratingText);
            if (!isNaN(parsed)) rating = parsed;
          }
        }

        const reviewsText = $("#acrCustomerReviewText").text().trim() || 
                            $("#acrCustomerReviewLink").text().trim() ||
                            $("[data-hook='total-review-count']").text().trim();
        if (reviewsText) {
          const cleanReviews = reviewsText.replace(/[^\d]/g, "");
          if (cleanReviews) {
            reviewsCount = parseInt(cleanReviews);
          }
        }

        const isAmazonChoice = $("span[id*='amazons-choice']").length > 0 || 
                               $(".ac-badge-wrapper").length > 0 ||
                               $(".ac-badge-text").length > 0;

        const shortDescription = $("#featurebullets_feature_div").text().trim().replace(/\s+/g, ' ') || 
                                 $("#feature-bullets").text().trim().replace(/\s+/g, ' ') || "";
        const fullDescription = $("#productDescription").text().trim().replace(/\s+/g, ' ') || 
                                $("#aplus").text().trim().replace(/\s+/g, ' ') || "";

        const images =
          $("#imgBlkFront").attr("data-a-dynamic-image") ||
          $("#landingImage").attr("data-a-dynamic-image") ||
          $("[data-a-image-name]").first().attr("data-a-dynamic-image") ||
          "{}";
        
        let thumbnail = "";
        try {
          const imageUrls = Object.keys(JSON.parse(images));
          thumbnail = imageUrls[0] || "";
        } catch (e) {
          thumbnail = $("#landingImage").attr("src") || 
                      $("#imgBlkFront").attr("src") || 
                      $("#main-image").attr("src") || "";
        }
        
        // High res image trick as seen in amazon_scraper
        const thumbnailClean = thumbnail || "";
        const highResImage = thumbnailClean ? (thumbnailClean.split("._")[0] + ".jpg") : "";

        let currency = extractCurrency($(".a-price-symbol")) || 
                       (url.includes("amazon.in") ? "₹" : "$");

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

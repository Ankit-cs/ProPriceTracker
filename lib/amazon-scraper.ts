import * as cheerio from "cheerio";
import promiseRetry from "promise-retry";
import ScrapingAntClient from "@scrapingant/scrapingant-client";
import axios from "axios";

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
  features?: Record<string, string>;
  isInStock?: boolean;
  soldBy?: string;
  deliveryDate?: string;
  frequentlyBoughtTogether?: string[];
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
    const priceText = element.first().text().trim();
    if (priceText) {
      const cleanPrice = cleanPriceString(priceText);
      if (cleanPrice && !isNaN(Number(cleanPrice))) return cleanPrice;
    }
  }
  return "";
}

function extractCurrency(element: any) {
  const currencyText = element.first().text().trim().slice(0, 1);
  return currencyText ? currencyText : "";
}


        
export function parseAmazonHtml(cleanHtml: string, url: string): ScrapedProduct {
  const $ = cheerio.load(cleanHtml);

        const title = $("#productTitle").first().text().trim() || 
                      $("#title").first().text().trim() || 
                      $(".a-size-large.product-title-word-break").first().text().trim() || "";
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

        const amazonId = $("#ASIN").first().val() as string || url.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || "";
        
        let rating = 0;
        let reviewsCount = 0;
        
        const ratingText = $("#acrPopover").first().attr("title") || 
                           $("[data-hook='rating-out-of-five']").first().text().trim() || 
                           $("i.a-icon-star span.a-icon-alt").first().text().trim() || 
                           $(".a-icon-star-small .a-icon-alt").first().text().trim();
        if (ratingText) {
          const match = ratingText.match(/(\d+\.?\d*)\s*(out of|von|sur|de)/i);
          if (match) {
            rating = parseFloat(match[1]);
          } else {
            const parsed = parseFloat(ratingText);
            if (!isNaN(parsed)) rating = parsed;
          }
        }

        const reviewsText = $("#acrCustomerReviewText").first().text().trim() || 
                            $("#acrCustomerReviewLink").first().text().trim() ||
                            $("[data-hook='total-review-count']").first().text().trim();
        if (reviewsText) {
          const cleanReviews = reviewsText.replace(/[^\d]/g, "");
          if (cleanReviews) {
            reviewsCount = parseInt(cleanReviews);
          }
        }

        const isAmazonChoice = $("span[id*='amazons-choice']").length > 0 || 
                               $(".ac-badge-wrapper").length > 0 ||
                               $(".ac-badge-text").length > 0;

        // Remove inline scripts and styles so they don't pollute the text extraction
        $("script, style").remove();

        // Extract feature bullets (Short description)
        let shortDescription = "";
        const shortDescElem = $("#featurebullets_feature_div").length > 0 ? $("#featurebullets_feature_div") : $("#feature-bullets");
        const liItems = shortDescElem.find("li span.a-list-item");
        
        if (liItems.length > 0) {
           const items: string[] = [];
           liItems.each((_, el) => {
              // Strip checkmarks, emojis, and weird bullet points
              let text = $(el).text().trim().replace(/\s+/g, ' ');
              text = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
              text = text.replace(/[✔✓•*]/g, '').trim();

              if (text && !text.toLowerCase().includes("make sure this fits")) {
                items.push(text);
              }
           });
           shortDescription = items.length > 0 ? JSON.stringify(items) : "";
        } else {
           let text = shortDescElem.first().text().trim().replace(/\s+/g, ' ');
           text = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
           text = text.replace(/[✔✓•*]/g, '').trim();
           shortDescription = text || "";
        }

        // Extract Technical Details / Product Specifications as Key-Value Pairs
        const productDetails: Record<string, string> = {};

        // 1. Try to parse Technical Details Table (Common for electronics)
        $("table.prodDetTable tr").each((_, tr) => {
           const key = $(tr).find("th").text().trim().replace(/\s+/g, ' ').replace(/\u200e/g, '');
           const value = $(tr).find("td").text().trim().replace(/\s+/g, ' ').replace(/\u200e/g, '');
           if (key && value) {
              productDetails[key] = value;
           }
        });

        // 2. Try to parse Product Details Bullets (Common for other categories)
        $("#detailBullets_feature_div ul li").each((_, li) => {
           const textParts = $(li).find("span.a-list-item > span");
           if (textParts.length >= 2) {
              const key = $(textParts[0]).text().replace(':', '').trim().replace(/\u200e/g, '');
              const value = $(textParts[1]).text().trim().replace(/\u200e/g, '');
              if (key && value) {
                 productDetails[key] = value;
              }
           }
        });

        // Convert the extracted Key-Value pairs into a JSON string for fullDescription
        let fullDescription = "";
        if (Object.keys(productDetails).length > 0) {
            fullDescription = JSON.stringify(productDetails);
        } else {
            // Fallback if no tables exist
            fullDescription = $("#productDescription").first().text().trim().replace(/\s+/g, ' ') || "";
        }
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

        const isOutOfStock = $("#availability span").first().text().trim().toLowerCase().includes("currently unavailable") ||
                             $("#availability span").first().text().trim().toLowerCase().includes("out of stock");
        const isInStock = !isOutOfStock;

        if (!title || !finalPrice) {
          throw new Error("Missing price or title, possibly blocked by CAPTCHA");
        }

        // Sold By
        const soldBy = $("#merchant-info").first().text().trim().replace(/\s+/g, ' ') || 
                       $(".tabular-buybox-text[merchant]").first().text().trim().replace(/\s+/g, ' ') || 
                       $("#sellerProfileTriggerId").first().text().trim() || "";

        // Delivery Date
        const deliveryDate = $("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold").first().text().trim() || 
                             $("#deliveryBlockMessage").first().text().trim().replace(/\s+/g, ' ') || "";

        // Frequently Bought Together
        const frequentlyBoughtTogether: string[] = [];
        $("#sims-fbt-form .a-checkbox input[name='submit.addToCart']").each((_, el) => {
           const val = $(el).val() as string;
           if (val) frequentlyBoughtTogether.push(val);
        });
        $(".sims-fbt-image-box a").each((_, el) => {
           const href = $(el).attr("href");
           if (href) frequentlyBoughtTogether.push(href.split("/dp/")[1]?.split("/")[0] || href);
        });

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
    fullDescription,
    features: productDetails,
    isInStock,
    soldBy,
    deliveryDate,
    frequentlyBoughtTogether: [...new Set(frequentlyBoughtTogether.filter(Boolean))]
  };
}

async function scrapeWithScrapingAnt(url: string, initialCountryCode: string, pincode?: string): Promise<ScrapedProduct> {
  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGANT_API_KEY is not defined in environment variables");

  const client = new ScrapingAntClient({ apiKey });
  
  // Smart Proxy Rotation: List of fallback proxy regions
  const proxyRegions = [initialCountryCode, "us", "gb", "de", "ca", "fr", "it", "es"].filter((v, i, a) => a.indexOf(v) === i);

  let js_snippet: string | undefined = undefined;
  if (pincode) {
    const jsCode = `
      const setPincode = async () => {
        try {
          const el = document.getElementById('nav-global-location-popover-link') || document.getElementById('nav-global-location-slot');
          if (el) el.click();
          await new Promise(r => setTimeout(r, 2000));
          const input = document.getElementById('GLUXZipUpdateInput');
          if (input) {
            input.value = '${pincode}';
            const applyBtn = document.getElementById('GLUXZipUpdate') || document.querySelector('#GLUXZipUpdate input');
            if (applyBtn) {
              applyBtn.click();
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        } catch(e) {}
      };
      await setPincode();
    `;
    js_snippet = Buffer.from(jsCode).toString('base64');
  }

  return promiseRetry(
    async (retry, attempt) => {
      // Use a different region for each attempt if possible
      const regionIndex = (attempt - 1) % proxyRegions.length;
      const countryCode = proxyRegions[regionIndex];
      
      try {
        console.log(`[ScrapingAnt] Attempt ${attempt} for ${url} (Proxy Country: ${countryCode}, Pincode: ${pincode || 'none'})`);
        const options: any = { proxy_country: countryCode };
        if (js_snippet) {
           options.js_snippet = js_snippet;
        }
        const response = await client.scrape(url, options);
        const cleanHtml = response.content.replace(/\s\s+/g, "").replace(/\n/g, "");
        return parseAmazonHtml(cleanHtml, url);
      } catch (error: any) {
        console.error(`[ScrapingAnt] Failed attempt ${attempt} (Proxy: ${countryCode}):`, error.message);
        retry(error);
      }
    },
    { retries: 3, factor: 1.5, minTimeout: 2000 }
  );
}

async function scrapeWithAxios(url: string): Promise<ScrapedProduct> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    return parseAmazonHtml(response.data, url);
  } catch (error: any) {
    console.error(`[AxiosFallback] Failed:`, error.message);
    throw error;
  }
}

export async function resolveShortUrl(url: string): Promise<string> {
  if (url.includes('amzn.in') || url.includes('amzn.eu') || url.includes('amzn.to')) {
    try {
      // Fetch the headers using GET to follow the redirect and get the expanded amazon.in URL
      // (Amazon sometimes blocks HEAD requests)
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (response.url) return response.url;
    } catch (e) {
      console.error("Failed to resolve short URL:", e);
    }
  }
  return url;
}

export async function scrapeAmazonProduct(url: string, userRegion?: string, pincode?: string): Promise<ScrapedProduct> {
  if (!url) throw new Error("No URL provided");

  const resolvedUrl = await resolveShortUrl(url);
  const finalUrl = cleanAmazonUrl(resolvedUrl);

  // You mentioned you are building this for India only, so force the region to 'in'.
  let countryCode = "in";
  try {
    return await scrapeWithScrapingAnt(finalUrl, countryCode, pincode);
  } catch (error) {
    console.error("ScrapingAnt failed, trying axios fallback...");
    return await scrapeWithAxios(finalUrl);
  }
}

export function cleanAmazonUrl(url: string): string {
  if (!url) return url;
  
  if (!url.includes("amazon.") && !url.includes("amzn.")) {
    return url;
  }
  
  try {
    const parsed = new URL(url);
    const dpMatch = parsed.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
    const gpMatch = parsed.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    
    const asin = (dpMatch && dpMatch[1]) || (gpMatch && gpMatch[1]);
    if (asin) {
      return `${parsed.protocol}//${parsed.hostname}/dp/${asin.toUpperCase()}`;
    }
  } catch (e) {
    // ignore
  }
  return url;
}

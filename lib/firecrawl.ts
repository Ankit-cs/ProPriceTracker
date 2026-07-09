import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export interface ScrapedProduct {
  productName: string;
  currentPrice: number;
  currencyCode?: string;
  productImageUrl?: string;
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const retries = 3;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Firecrawl Scraper] Attempt ${attempt} to scrape ${url}`);
      const result = await firecrawl.scrape(url, {
        formats: [{
          type: "json",
          prompt:
            "Extract the product name as 'productName', current price as a number in INR as 'currentPrice', currency code (must be 'INR') as 'currencyCode', and product image URL as 'productImageUrl' if available",
          schema: {
            type: "object",
            properties: {
              productName: { type: "string" },
              currentPrice: { type: "number" },
              currencyCode: { type: "string" },
              productImageUrl: { type: "string" },
            },
            required: ["productName", "currentPrice"],
          },
        }]
      });

      const extractedData = result.json as any;

      if (!extractedData || !extractedData.productName || !extractedData.currentPrice) {
        throw new Error("Missing required productName or currentPrice in extracted data");
      }

      return extractedData as ScrapedProduct;
    } catch (error: any) {
      console.error(`[Firecrawl Scraper] Attempt ${attempt} failed:`, error.message);
      if (attempt === retries) {
        throw new Error(`Failed to scrape product after ${retries} attempts: ${error.message}`);
      }
      // Wait before retrying (exponential backoff: 1.5s, 3s)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error("Failed after retries");
}

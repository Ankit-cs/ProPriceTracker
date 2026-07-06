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
  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: [{
        type: "json",
        prompt:
          "Extract the product name as 'productName', current price as a number as 'currentPrice', currency code (INR, USD, EUR, etc) as 'currencyCode', and product image URL as 'productImageUrl' if available",
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
      }],
    });

    // Firecrawl returns data in result.json in v2
    const extractedData = result.json as ScrapedProduct;

    if (!extractedData || !extractedData.productName) {
      throw new Error("No data extracted from URL");
    }

    return extractedData;
  } catch (error) {
    console.error("Firecrawl scrape error:", error);
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}

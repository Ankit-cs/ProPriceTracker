require('dotenv').config();
const FirecrawlApp = require("@mendable/firecrawl-js").default;
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function test() {
  try {
    const result = await firecrawl.scrapeUrl("https://example.com", {
      formats: ["json"],
      jsonOptions: {
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
    });
    console.log("Success with list URL:", JSON.stringify(result));
  } catch (e) {
    console.error("Error with list URL:", e);
  }

  try {
    const result = await firecrawl.extract({
      urls: ["https://www.amazon.com/dp/B09G96T27P"],
      prompt: "Extract the product name as 'productName', current price as a number as 'currentPrice', currency code (USD, EUR, etc) as 'currencyCode', and product image URL as 'productImageUrl' if available",
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
    });
    console.log("Success with object params:", JSON.stringify(result));
  } catch (e) {
    console.error("Error with object params:", e);
  }
}
test();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const { getJson } = require('serpapi');
const axios = require('axios');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const serpApiKey = process.env.SERPAPI_KEY;

if (!connectionString) {
  console.error("DATABASE_URL is missing in environment.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fetchPriceHistorySlug(productName) {
  if (!serpApiKey) return null;
  try {
    const query = productName
      .split(" ")
      .slice(0, 7)
      .join(" ")
      .replace(/[,|]/g, "")
      .trim();

    const searchTerm = `${query} site:pricehistoryapp.com`;
    console.log(`[SerpAPI] Searching slug for: "${productName}"...`);

    const result = await getJson("google", {
      api_key: serpApiKey,
      q: searchTerm,
    });

    const organicResults = result.organic_results || [];
    if (organicResults.length > 0) {
      const link = organicResults[0].link;
      if (link && link.includes("pricehistoryapp.com/product/")) {
        const parts = link.split("/");
        return parts.length > 4 ? parts.slice(4).join("/") : "";
      }
    }
  } catch (error) {
    console.error(`Error searching slug for "${productName}":`, error.message);
  }
  return null;
}

async function scrapeHistoryPoints(slug) {
  try {
    const url = `https://pricehistoryapp.com/product/${slug}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = res.data;
    const historyMatch = html.match(/priceHistory\\*"\s*:\s*\\*\[([\s\S]*?)\\*\]/);
    if (historyMatch) {
      const cleanHistoryStr = "[" + historyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') + "]";
      return JSON.parse(cleanHistoryStr);
    }
  } catch (error) {
    console.error(`Error scraping history points for slug "${slug}":`, error.message);
  }
  return null;
}

async function backfill() {
  try {
    await client.connect();
    console.log("Connected to database successfully.");

    // 1. Fetch all products
    const res = await client.query("SELECT id, name, currency, geturl FROM products");
    const products = res.rows;
    console.log(`Found ${products.length} products in database.`);

    for (let product of products) {
      console.log(`\n-----------------------------------------`);
      console.log(`Processing product ID: ${product.id} - "${product.name}"`);

      let slug = product.geturl;
      if (!slug) {
        slug = await fetchPriceHistorySlug(product.name);
        if (slug) {
          console.log(`Resolved slug for product: "${slug}". Updating database...`);
          await client.query("UPDATE products SET geturl = $1 WHERE id = $2", [slug, product.id]);
        } else {
          console.log(`Could not find a slug on PriceHistoryApp for: "${product.name}". Skipping history backfill.`);
          continue;
        }
      } else {
        console.log(`Using existing slug: "${slug}"`);
      }

      // 2. Scrape price history points
      const scrapedHistory = await scrapeHistoryPoints(slug);
      if (!scrapedHistory || scrapedHistory.length === 0) {
        console.log(`No history points found for slug: "${slug}".`);
        continue;
      }

      console.log(`Found total ${scrapedHistory.length} history points.`);

      // 3. Filter to last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const filteredHistory = scrapedHistory.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= ninetyDaysAgo;
      });

      console.log(`Filtered to ${filteredHistory.length} history points in the last 90 days.`);

      if (filteredHistory.length > 0) {
        // 4. Delete existing history to avoid duplicates
        console.log("Cleaning up existing price history in database...");
        await client.query("DELETE FROM price_history WHERE product_id = $1", [product.id]);

        // 5. Bulk insert new filtered points
        console.log("Inserting 90-day history points in bulk...");
        
        // Construct bulk values insert
        const values = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const item of filteredHistory) {
          queryParams.push(product.id, item.price, product.currency || 'INR', new Date(item.date).toISOString());
          values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3})`);
          paramIndex += 4;
        }

        const insertQuery = `
          INSERT INTO price_history (product_id, price, currency, checked_at)
          VALUES ${values.join(", ")}
        `;

        await client.query(insertQuery, queryParams);
        console.log("Successfully backfilled price history!");
      } else {
        console.log("No price history points within the last 90 days to insert.");
      }
    }

    console.log("\n=========================================");
    console.log("Backfill operation completed successfully!");
  } catch (error) {
    console.error("Backfill operation failed:", error);
  } finally {
    await client.end();
  }
}

backfill();

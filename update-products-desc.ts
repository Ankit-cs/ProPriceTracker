import { createClient } from "@supabase/supabase-js";
import { scrapeAmazonProduct } from "./lib/amazon-scraper";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateDescriptions() {
  console.log("Fetching products from DB...");
  const { data: products, error } = await supabase.from("products").select("*");

  if (error || !products) {
    console.error("Error fetching products:", error);
    return;
  }

  console.log(`Found ${products.length} products. Updating...`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] Re-scraping: ${product.url}`);

    try {
      const scrapedData = await scrapeAmazonProduct(product.url);

      if (!scrapedData) {
         console.log(`Failed to scrape ${product.url}`);
         continue;
      }

      console.log(`Updating DB for ${product.id}...`);
      const { error: updateError } = await supabase
        .from("products")
        .update({
          short_description: scrapedData.shortDescription || "",
          full_description: scrapedData.fullDescription || ""
        })
        .eq("id", product.id);

      if (updateError) {
        console.error(`Error updating product ${product.id}:`, updateError);
      } else {
        console.log(`Success: ${product.id}`);
      }

      // Add a 4 second delay to avoid ScrapingAnt free tier rate limits (concurrency limit 1)
      await new Promise(resolve => setTimeout(resolve, 4000));
    } catch (e) {
      console.error(`Exception while processing ${product.url}:`, e);
    }
  }

  console.log("Done updating descriptions!");
}

updateDescriptions();

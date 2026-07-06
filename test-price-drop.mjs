import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPriceDrop() {
  console.log("Fetching products...");
  const { data: products, error } = await supabase.from("products").select("*");
  
  if (error || !products || products.length === 0) {
    console.error("No products found to test.");
    return;
  }

  // 1. Artificially inflate the price in the database so the scraper thinks it dropped
  console.log("Artificially raising the price in the database to simulate a future price drop...");
  for (const product of products) {
    const inflatedPrice = parseFloat(product.current_price) + 2000; // Raise by 2000
    await supabase.from("products").update({ current_price: inflatedPrice }).eq("id", product.id);
  }
  
  console.log("Database updated! The system now thinks your products used to be more expensive.");
  
  // 2. Trigger the cron job
  console.log("Triggering the cron job to check prices (this may take 10-20 seconds to scrape)...");
  
  const response = await fetch("http://localhost:3000/api/cron/check-prices", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.CRON_SECRET}`
    }
  });
  
  const result = await response.json();
  console.log("Cron Job Result:", result);
  
  if (result.results && result.results.alertsSent > 0) {
    console.log("✅ SUCCESS! The system detected the price drop and sent an email to your inbox.");
  } else {
    console.log("No alerts sent. Check the output above.");
  }
}

testPriceDrop();

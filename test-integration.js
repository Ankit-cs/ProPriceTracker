import { scrapeFlipkartProduct } from './lib/flipkart-scraper.js';
import { scrapeMyntraProduct } from './lib/myntra-scraper.js';

async function test() {
  console.log("=== Testing Flipkart ===");
  try {
    const flipkartData = await scrapeFlipkartProduct("https://www.flipkart.com/pintola-all-natural-peanut-butter-crunchy-unsweetened/p/itm333cafa32ef03?pid=JASFYBHBBMTSJCTB");
    console.log(JSON.stringify(flipkartData, null, 2));
  } catch(e) {
    console.error("Flipkart failed:", e.message);
  }

  console.log("\n=== Testing Myntra ===");
  try {
    const myntraData = await scrapeMyntraProduct("https://www.myntra.com/mailers/bottomwear/h&m/h&m-relaxed-fit-printed-track-pants/41029917/buy");
    console.log(JSON.stringify(myntraData, null, 2));
  } catch(e) {
    console.error("Myntra failed:", e.message);
  }
}

test();

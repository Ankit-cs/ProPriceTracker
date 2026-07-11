import { scrapeProduct } from './lib/firecrawl.js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = "https://dl.flipkart.com/dl/pintola-all-natural-peanut-butter-crunchy-unsweetened/p/itm333cafa32ef03?pid=JASFYBHBBMTSJCTB&lid=LSTJASFYBHBBMTSJCTBI5MUEZ&marketplace=FLIPKART&_refId=&_appId=CL";

async function test() {
  console.log("Scraping with Firecrawl...");
  try {
    const data = await scrapeProduct(url);
    console.log("Result:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();

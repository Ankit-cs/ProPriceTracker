const { getJson } = require("serpapi");
const axios = require("axios");
const cheerio = require("cheerio");

async function test() {
  const apiKey = "4b7378fb5daf69311233c99baf352f23b9a261a6d53b275fd4542c762317244e";
  
  const result = await getJson("google", {
    api_key: apiKey,
    q: "Sony WH-1000XM4 site:pricehistoryapp.com",
  });
  
  const link = result.organic_results?.[0]?.link;
  if (!link) return;
  
  const res = await axios.get(link, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
  });

  const $ = cheerio.load(res.data);
  $("script").each((i, el) => {
    const text = $(el).text();
    if (text.includes("priceHistory")) {
      console.log(`Script ${i} includes priceHistory. Length: ${text.length}`);
      // Find the index of priceHistory
      const idx = text.indexOf("priceHistory");
      console.log("Snippet around priceHistory:");
      console.log(text.slice(idx - 100, idx + 500));
    }
  });
}

test().catch(console.error);

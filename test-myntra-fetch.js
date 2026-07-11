import axios from 'axios';
import * as cheerio from 'cheerio';

const url = "https://www.myntra.com/mailers/bottomwear/h&m/h&m-relaxed-fit-printed-track-pants/41029917/buy";

async function test() {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    console.log("Title:", $('title').text());
    
    // Look for JSON-LD or script tags with data
    const scripts = $('script').toArray();
    let foundData = false;
    for (const script of scripts) {
      const content = $(script).html() || '';
      if (content.includes('pdpData') || content.includes('window.__myx')) {
        console.log("Found script with potential data. Length:", content.length);
        foundData = true;
      }
    }
    if (!foundData) {
      console.log("No obvious data scripts found. HTML length:", html.length);
    }
  } catch(e) {
    console.error("Axios error:", e.message);
  }
}

test();

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const url = "https://www.meesho.com/s/p/6x14t4?utm_source=s_cc";

async function test() {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log("Title:", $('title').text());
    console.log("og:image:", $('meta[property="og:image"]').attr('content'));
    console.log("og:description:", $('meta[property="og:description"]').attr('content'));
    
    // Attempt to extract price. Meesho often uses JSON-LD or specific classes.
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (let script of scripts) {
       const content = $(script).html();
       try {
         const data = JSON.parse(content);
         if (data.offers && data.offers.price) {
           console.log("JSON-LD Price:", data.offers.price);
         }
       } catch(e) {}
    }
  } catch(e) {
    console.error(e);
  }
}

test();

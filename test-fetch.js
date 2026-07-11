import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const url = "https://dl.flipkart.com/dl/pintola-all-natural-peanut-butter-crunchy-unsweetened/p/itm333cafa32ef03?pid=JASFYBHBBMTSJCTB&lid=LSTJASFYBHBBMTSJCTBI5MUEZ&marketplace=FLIPKART&_refId=&_appId=CL";

async function test() {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log("Title:", $('title').text());
    console.log("og:image:", $('meta[property="og:image"]').attr('content'));
    console.log("og:description:", $('meta[property="og:description"]').attr('content'));
    console.log("rating:", $('div._3LWZlK').text()); // Flipkart specific class, maybe
  } catch(e) {
    console.error(e);
  }
}

test();

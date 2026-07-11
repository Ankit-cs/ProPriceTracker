import * as fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('flipkart.html', 'utf8');
const $ = cheerio.load(html);

const scripts = $('script[id="is_script"]').html();
if (scripts) {
  try {
    const data = JSON.parse(scripts.replace('window.__INITIAL_STATE__ = ', '').replace(/;$/, ''));
    console.log("Found JSON data!");
    // Save to a file for easier inspection
    fs.writeFileSync('flipkart.json', JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Failed to parse JSON:", e.message);
  }
} else {
  console.log("No is_script found.");
}

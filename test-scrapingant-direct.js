const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val.trim();
      }
    });
  }
}

loadEnv();

async function testDirectV2() {
  const apiKey = process.env.SCRAPINGANT_API_KEY;
  const url = 'https://www.amazon.in/dp/8172234988'; // Real Alchemist book URL

  if (!apiKey) {
    console.error('Error: SCRAPINGANT_API_KEY is not defined in .env');
    return;
  }

  console.log(`Sending direct ScrapingAnt V2 HTTP request for URL: ${url}`);
  try {
    const response = await axios.get('https://api.scrapingant.com/v2/general', {
      params: {
        url: url,
        'x-api-key': apiKey,
        proxy_country: 'in'
      },
      timeout: 30000
    });

    console.log('Request successful!');
    console.log('Response content length:', response.data.length);
    console.log('Content preview (first 500 chars):');
    console.log(response.data.slice(0, 500));

    // Try parsing
    const $ = cheerio.load(response.data);
    const title = $("#productTitle").text().trim() || 
                  $("#title").text().trim() || "";
    console.log('Parsed Title:', title);

    if (title) {
      console.log('SUCCESS: ScrapingAnt V2 direct call scraped the title successfully!');
    } else {
      console.log('Failed to parse title. Content might be CAPTCHA or blocked.');
    }
  } catch (error) {
    console.error('Direct v2 call failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Body:', error.response.data);
    }
  }
}

testDirectV2();

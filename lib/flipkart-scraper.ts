import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedProduct } from './amazon-scraper';

export async function scrapeFlipkartProduct(url: string): Promise<ScrapedProduct> {
  if (!url) throw new Error("No URL provided");
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const $ = cheerio.load(response.data);
    
    // Title
    let title = $('.B_NuCI').text().trim() || $('.VU-ZEz').text().trim() || $('h1').text().trim() || $('title').text().trim();
    if (title.includes('Buy')) {
      title = title.split('Buy')[1].split('at')[0].trim();
    }
    
    // Price
    const currentPriceStr = $('div._30jeq3._16Jk6d').text().trim() || $('div.Nx9bqj.CxhGGd').text().trim();
    const originalPriceStr = $('div._3I9_wc._2p6lqe').text().trim() || $('div.yRaY8j.A6z5tZ').text().trim();
    
    const currentPrice = parseInt(currentPriceStr.replace(/[^0-9]/g, '')) || 0;
    const originalPrice = parseInt(originalPriceStr.replace(/[^0-9]/g, '')) || currentPrice;
    
    const isDiscounted = originalPrice > currentPrice && currentPrice > 0;
    const savings = isDiscounted ? (originalPrice - currentPrice) : 0;
    
    // Image: Search for typical Flipkart product image classes, or fallback to og:image, or the first large image
    let productImageUrl = $('img.v2bfXq').attr('src') || $('img._396cs4._2amPTt._3qGmMb').attr('src') || $('img._2r_T1I').attr('src') || $('meta[property="og:image"]').attr('content') || '';
    if (!productImageUrl || productImageUrl.includes('data:image')) {
      productImageUrl = $('img').toArray().map(el => $(el).attr('src')).find(src => src && src.includes('http') && !src.includes('logo')) || '';
    }
    
    // Ratings & Reviews
    const ratingStr = $('div._3LWZlK').first().text().trim() || $('div.XQDdHH').first().text().trim();
    const rating = parseFloat(ratingStr) || 0;
    
    const reviewsText = $('span._2_R_DZ').first().text().trim() || $('span.Wphh3N').first().text().trim();
    let reviewsCount = 0;
    if (reviewsText) {
      const match = reviewsText.match(/(\d+,?\d*)\s*(Reviews|reviews)/);
      if (match) {
        reviewsCount = parseInt(match[1].replace(/,/g, ''));
      }
    }
    
    // Seller & Delivery
    const soldBy = $('#sellerName span span').first().text().trim() || $('div#sellerName span span').text().trim() || $('div:contains("Sold by")').last().text().replace('Sold by', '').trim() || '';
    const deliveryDate = $('div._3XINqE').first().text().trim() || $('span._1TPvTK').first().text().trim() || $('div:contains("Delivery by")').last().text().trim() || '';
    
    // Features / Description
    const features: Record<string, string> = {};
    $('div._3k-BhJ tr._1s_Smc.row').each((_, el) => {
      const key = $(el).find('td._1hKmbr').text().trim();
      const val = $(el).find('td.URwL2w').text().trim();
      if (key && val) features[key] = val;
    });

    return {
      productName: title || 'Flipkart Product',
      currentPrice: currentPrice,
      currency: "₹",
      productImageUrl: productImageUrl,
      originalPrice: originalPrice,
      isDiscounted,
      savings,
      rating,
      reviewsCount,
      soldBy,
      deliveryDate,
      features,
      fullDescription: JSON.stringify(features),
      isInStock: !$('.G6XhRU').text().toLowerCase().includes('sold out'),
    };
  } catch (error: any) {
    console.error(`[FlipkartScraper] Failed to scrape:`, error.message);
    throw error;
  }
}

import axios from 'axios';
import { ScrapedProduct } from './amazon-scraper';

/**
 * Extract Myntra product ID from URL.
 * URL format: https://www.myntra.com/[category]/[brand]/[slug]/[productId]/buy
 */
function extractMyntraProductId(url: string): string | null {
  const match = url.match(/\/(\d+)\/buy/);
  return match ? match[1] : null;
}

export async function scrapeMyntraProduct(url: string): Promise<ScrapedProduct> {
  if (!url) throw new Error("No URL provided");

  const productId = extractMyntraProductId(url);
  if (!productId) throw new Error(`Could not extract Myntra product ID from URL: ${url}`);

  console.log(`[MyntraScraper] Fetching product ID: ${productId}`);

  // Use Myntra's internal gateway API - returns clean JSON, no bot blocking
  const apiUrl = `https://www.myntra.com/gateway/v2/product/${productId}`;

  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Referer': 'https://www.myntra.com/',
      'Origin': 'https://www.myntra.com',
      'x-location-code': 'MH',
      'x-meta-app': 'context=web',
    },
    timeout: 15000,
  });

  const data = response.data;
  const style = data?.style || data?.product || {};

  // Product name
  const brandName = style?.brand?.name || style?.brandName || '';
  const productName = style?.name || style?.productTitle || '';
  const title = `${brandName} ${productName}`.trim() || 'Myntra Product';

  // Price
  const priceObj = style?.price || style?.priceDetails || {};
  const currentPrice = priceObj?.discounted || priceObj?.discountedPrice || priceObj?.mrp || 0;
  const originalPrice = priceObj?.mrp || currentPrice;

  // Image — use highest resolution available
  let productImageUrl = '';
  const media = style?.media || style?.images;
  if (Array.isArray(media) && media.length > 0) {
    productImageUrl = media[0]?.secureSrc || media[0]?.src || '';
  } else if (style?.media?.albums?.length > 0) {
    const album = style.media.albums[0];
    if (album?.images?.length > 0) {
      productImageUrl = album.images[0].secureSrc || album.images[0].src || '';
    }
  }
  // If still empty, try top-level images array
  if (!productImageUrl && Array.isArray(style?.images)) {
    productImageUrl = style.images[0]?.secureSrc || style.images[0]?.src || '';
  }

  // Rating & reviews
  const ratings = style?.ratings || style?.rating || {};
  const rating = parseFloat(ratings?.averageRating || ratings?.rating || 0);
  const reviewsCount = parseInt(ratings?.totalCount || ratings?.count || 0);

  // Seller
  let soldBy = '';
  const sellers = style?.sellers || [];
  if (sellers.length > 0) {
    soldBy = sellers[0]?.supplierName || sellers[0]?.name || '';
  }

  // Features/description
  const fullDescription = style?.description || style?.longDescription || '';
  const features: Record<string, string> = {};
  const attributes = style?.attributes || style?.productDetails || [];
  if (Array.isArray(attributes)) {
    attributes.forEach((attr: any) => {
      if (attr?.name && attr?.value) features[attr.name] = attr.value;
    });
  }

  const isDiscounted = originalPrice > currentPrice && currentPrice > 0;
  const savings = isDiscounted ? (originalPrice - currentPrice) : 0;
  const isInStock = style?.availability !== 'OUT_OF_STOCK' && style?.available !== false;

  console.log(`[MyntraScraper] Success: ${title} @ ₹${currentPrice}`);

  return {
    productName: title,
    currentPrice,
    currency: '₹',
    productImageUrl,
    originalPrice,
    isDiscounted,
    savings,
    rating,
    reviewsCount,
    soldBy,
    deliveryDate: '',
    features,
    fullDescription,
    isInStock,
  };
}

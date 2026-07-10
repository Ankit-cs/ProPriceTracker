/**
 * Cleans Amazon URLs by removing tracking parameters and affiliate tags.
 * Returns a canonical URL for accurate tracking.
 */
export function cleanAmazonUrl(url: string): string {
  try {
    // Extract product ID from various Amazon URL formats
    const productIdMatch = url.match(
      /\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|\/product\/([A-Z0-9]{10})|\/([A-Z0-9]{10})\/|\/([A-Z0-9]{10})\?|\/([A-Z0-9]{10})$/
    );

    if (productIdMatch) {
      const productId =
        productIdMatch[1] ||
        productIdMatch[2] ||
        productIdMatch[3] ||
        productIdMatch[4] ||
        productIdMatch[5] ||
        productIdMatch[6];

      // Determine the Amazon domain
      const domain = url.includes("amazon.in")
        ? "amazon.in"
        : url.includes("amazon.co.uk")
        ? "amazon.co.uk"
        : url.includes("amazon.de")
        ? "amazon.de"
        : url.includes("amazon.fr")
        ? "amazon.fr"
        : "amazon.com";

      return `https://www.${domain}/dp/${productId}`;
    }

    // If no product ID found, return original URL without parameters
    return url.split("?")[0].split("#")[0];
  } catch (error) {
    console.error("Error cleaning Amazon URL:", error);
    return url;
  }
}

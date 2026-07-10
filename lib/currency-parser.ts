/**
 * Extracts a robust numeric price from a messy text string, supporting Indian formats.
 */
export function extractPrice(priceText: string): number | null {
  if (!priceText) return null;

  // Remove currency symbols and non-numeric characters except dots and commas
  const cleanPrice = priceText.replace(/[^\d.,]/g, "");

  if (!cleanPrice) return null;

  let firstPrice: string | undefined;

  // Check for larger comma patterns like 1,29,999 (Indian lakh format)
  const lakhMatch = cleanPrice.match(/\d{1,2},\d{2},\d{3}/)?.[0]?.replace(/,/g, "");

  // Check for comma patterns like 2,999, 14,999
  const commaMatch = cleanPrice.match(/\d{1,2},\d{3}/)?.[0]?.replace(/,/g, "");

  // Check for simple whole numbers like 2999, 29999
  const wholeNumberMatch = cleanPrice.match(/^\d{3,}$/)?.[0];
  
  // Check for decimal patterns like 2999.00, 29.99
  const decimalMatch = cleanPrice.match(/\d+\.\d{1,2}/)?.[0];

  // Prioritize based on formatting patterns
  if (lakhMatch && parseInt(lakhMatch) >= 100) {
    firstPrice = lakhMatch;
  } else if (commaMatch && parseInt(commaMatch) >= 100) {
    firstPrice = commaMatch;
  } else if (wholeNumberMatch && parseInt(wholeNumberMatch) >= 100) {
    firstPrice = wholeNumberMatch;
  } else if (decimalMatch && parseFloat(decimalMatch) >= 1) {
    firstPrice = decimalMatch;
  } else {
    // Fallback
    firstPrice = cleanPrice.match(/\d+/)?.[0];
  }

  if (firstPrice) {
    return parseFloat(firstPrice);
  }

  return null;
}

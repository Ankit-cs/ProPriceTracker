/**
 * Generates Tiered AI Buying Recommendations based on mathematical thresholds.
 */

export interface BuyingRecommendation {
  message: string;
  type: "excellent" | "good" | "decent" | "moderate" | "wait";
}

export function getTieredRecommendation(
  currentPrice: number,
  averagePrice: number,
  lowestPrice: number,
  discountRate: number,
  dropChances: number = 0
): BuyingRecommendation {
  
  if (currentPrice <= lowestPrice * 1.05 && lowestPrice > 0) {
    // Current price is within 5% of lowest price
    return {
      message: "🟢 Excellent time to buy! Price is at or near its lowest.",
      type: "excellent"
    };
  }
  
  if (currentPrice <= averagePrice * 0.9 && averagePrice > 0) {
    // Current price is 10% below average
    return {
      message: "🟢 Good time to buy! Price is below average.",
      type: "good"
    };
  }
  
  if (discountRate >= 20) {
    // Good discount available
    return {
      message: "🟡 Decent time to buy! Good discount available.",
      type: "decent"
    };
  }
  
  if (dropChances >= 70) {
    // High chance of price drop
    return {
      message: "🔴 Consider waiting! High chance of price drop soon.",
      type: "wait"
    };
  }
  
  if (currentPrice >= averagePrice * 1.1 && averagePrice > 0) {
    // Price is 10% above average
    return {
      message: "🔴 Consider waiting! Price is above average.",
      type: "wait"
    };
  }
  
  // Neutral situation
  return {
    message: "🟡 Moderate time to buy. Price is average.",
    type: "moderate"
  };
}

import Sentiment from 'sentiment';

const sentiment = new Sentiment();

export function analyzeSentiment(text: string): { score: number, label: 'Bullish' | 'Bearish' | 'Neutral' } {
  if (!text) return { score: 0, label: 'Neutral' };
  
  const result = sentiment.analyze(text);
  
  let label: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (result.score > 2) label = 'Bullish';
  else if (result.score < -2) label = 'Bearish';
  
  return { score: result.score, label };
}

export function calculateMovingAverage(priceHistory: { price: number }[], period: number = 30): number | null {
  if (!priceHistory || priceHistory.length === 0) return null;
  
  const recent = priceHistory.slice(-period);
  const sum = recent.reduce((acc, curr) => acc + Number(curr.price), 0);
  return sum / recent.length;
}

export function calculateVolatility(priceHistory: { price: number }[]): number {
  if (!priceHistory || priceHistory.length < 2) return 0;
  
  const prices = priceHistory.map(p => Number(p.price));
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  if (avg === 0) return 0;
  
  // Return percentage spread as a volatility index
  return ((max - min) / avg) * 100;
}

export function getSignal(currentPrice: number, movingAverage: number | null): 'Strong Buy' | 'Wait' | 'Neutral' {
  if (movingAverage === null) return 'Neutral';
  
  const diff = ((currentPrice - movingAverage) / movingAverage) * 100;
  
  if (diff <= -5) return 'Strong Buy'; // Price is 5% below moving average
  if (diff >= 5) return 'Wait'; // Price is 5% above moving average
  
  return 'Neutral';
}

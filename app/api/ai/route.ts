import { NextResponse } from 'next/server';
import Sentiment from 'sentiment';

const sentiment = new Sentiment();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, product } = body;

    if (!query || !product) {
      return NextResponse.json({ error: "Missing query or product" }, { status: 400 });
    }

    // Analyze the sentiment of the user's query
    const result = sentiment.analyze(query);
    const score = result.score;
    
    // Determine the response based on the product signal and sentiment
    let responseText = "";

    if (product.signal === "Buy Now") {
        if (score > 0) {
            responseText = `It sounds like you're excited! Since the current price of ₹${product.current_price} is well below the average of ₹${Math.round(product.ma)}, this is an excellent time to buy.`;
        } else if (score < 0) {
            responseText = `You seem hesitant. While I understand your concern, mathematically the current price (₹${product.current_price}) is a great deal compared to the average (₹${Math.round(product.ma)}).`;
        } else {
            responseText = `Based on the data, the current price of ₹${product.current_price} is lower than the moving average of ₹${Math.round(product.ma)}. The signal is a strong 'Buy Now'.`;
        }
    } else if (product.signal === "Overpriced") {
        if (score > 0) {
            responseText = `I love your enthusiasm, but you might want to hold off. The current price (₹${product.current_price}) is higher than the average (₹${Math.round(product.ma)}).`;
        } else if (score < 0) {
            responseText = `Your skepticism is justified. The product is currently overpriced at ₹${product.current_price} (average is ₹${Math.round(product.ma)}). I recommend waiting.`;
        } else {
            responseText = `The data indicates this item is overpriced right now at ₹${product.current_price}. It's generally better to wait for a drop.`;
        }
    } else {
        // Wait signal
        if (score > 0) {
            responseText = `You're positive about this, but the price of ₹${product.current_price} is hovering right around its average. You can buy if you need it now, or wait for a dip.`;
        } else if (score < 0) {
            responseText = `It's okay to be unsure. The price (₹${product.current_price}) is average. Let's keep tracking it until a better deal comes along.`;
        } else {
            responseText = `The price is currently stable at ₹${product.current_price}. There's no strong signal to buy or avoid at this exact moment.`;
        }
    }

    // Provide a small bonus text
    const wordsFound = result.words.length > 0 ? ` (Key words detected: ${result.words.join(', ')})` : "";

    return NextResponse.json({ 
        response: responseText + wordsFound,
        sentimentScore: score 
    });

  } catch (error) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: "Failed to process AI request" }, { status: 500 });
  }
}

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateChartUrl(history: any[]) {
  if (!history || history.length === 0) return "";
  
  const sorted = [...history].sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime());
  const recent = sorted.slice(-14);
  const labels = recent.map(r => {
    const d = new Date(r.checked_at);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  const data = recent.map(r => parseFloat(r.price));

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Price',
        data,
        borderColor: 'rgb(250, 93, 25)',
        backgroundColor: 'rgba(250, 93, 25, 0.1)',
        fill: true,
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  };
  
  return `https://quickchart.io/chart?w=500&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}

export async function sendConsolidatedPriceDropAlert(
  userEmail: string,
  alerts: Array<{
    product: any;
    oldPrice: number;
    newPrice: number;
    priceDrop: number;
    percentageDrop: string;
    history?: any[];
  }>
) {
  try {
    if (!alerts || alerts.length === 0) return { success: true };

    const subject = alerts.length === 1 
      ? `🎉 Price Drop Alert: ${alerts[0].product.name}`
      : `🎉 Daily Deals Digest: ${alerts.length} products dropped in price!`;

    const htmlBody = alerts.map(alert => `
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 20px;">
        ${
          alert.product.image_url
            ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${alert.product.image_url}" alt="${alert.product.name}" style="max-width: 200px; height: auto; border-radius: 8px; border: 1px solid #e5e7eb;">
          </div>
        `
            : ""
        }
        <h2 style="color: #1f2937; margin-top: 0;">${alert.product.name}</h2>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>Price dropped by ${alert.percentageDrop}%!</strong>
          </p>
        </div>
        <table style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; background: #f9fafb; border-radius: 4px;">
              <div style="font-size: 14px; color: #6b7280;">Previous Price</div>
              <div style="font-size: 20px; color: #9ca3af; text-decoration: line-through;">
                ${alert.product.currency} ${alert.oldPrice.toFixed(2)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px;">
              <div style="font-size: 14px; color: #6b7280;">Current Price</div>
              <div style="font-size: 32px; color: #FA5D19; font-weight: bold;">
                ${alert.product.currency} ${alert.newPrice.toFixed(2)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #dcfce7; border-radius: 4px;">
              <div style="font-size: 14px; color: #166534;">You Save</div>
              <div style="font-size: 24px; color: #16a34a; font-weight: bold;">
                ${alert.product.currency} ${alert.priceDrop.toFixed(2)}
              </div>
            </td>
          </tr>
        </table>
        ${
          alert.history && alert.history.length > 0 
            ? `<div style="text-align: center; margin-top: 20px;">
                 <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Price History (Last 14 Checks)</h3>
                 <img src="${generateChartUrl(alert.history)}" alt="Price History Chart" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb;" />
               </div>`
            : ""
        }
        <div style="text-align: center; margin: 30px 0;">
          <a href="${alert.product.url}" 
             style="display: inline-block; background: #FA5D19; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Product →
          </a>
        </div>
      </div>
    `).join('');

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "updates@propricetracker.com",
      to: userEmail,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background: linear-gradient(135deg, #FA5D19 0%, #FF8C42 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center; margin-bottom: -10px; position: relative; z-index: 10;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 ${alerts.length === 1 ? 'Price Drop Alert!' : 'Daily Deals Digest'}</h1>
            </div>
            
            <div style="padding-top: 20px;">
              ${htmlBody}
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
              <p>You're receiving this email because you're tracking these products on ProPriceTracker.</p>
              <p style="margin-top: 10px;">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                }" style="color: #FA5D19; text-decoration: none;">
                  View All Tracked Products
                </a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { error };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Email error:", error);
    return { error: error.message };
  }
}

export async function sendWelcomeAlert(userEmail: string, product: any) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "updates@propricetracker.com",
      to: userEmail,
      subject: `🎉 Welcome to Price Tracking for ${product.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #FA5D19; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: white; margin: 0;">Welcome to ProPriceTracker 🚀</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p>You are now tracking <strong>${product.name}</strong>.</p>
              ${product.image_url ? `<img src="${product.image_url}" alt="Product" style="max-width: 200px; border-radius: 8px;" />` : ""}
              <p>We'll notify you automatically when the price drops or when it comes back in stock.</p>
              <a href="${product.url}" style="display: inline-block; background: #FA5D19; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Product</a>
            </div>
          </body>
        </html>
      `,
    });
    if (error) return { error };
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function sendBackInStockAlert(userEmail: string, product: any) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "updates@propricetracker.com",
      to: userEmail,
      subject: `🔥 ${product.name} is Back in Stock!`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #10b981; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: white; margin: 0;">Back in Stock Alert!</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Great news! <strong>${product.name}</strong> is now available for purchase.</p>
              ${product.image_url ? `<img src="${product.image_url}" alt="Product" style="max-width: 200px; border-radius: 8px;" />` : ""}
              <p>Grab yours before they run out again!</p>
              <a href="${product.url}" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Buy Now</a>
            </div>
          </body>
        </html>
      `,
    });
    if (error) return { error };
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function sendLowestPriceAlert(userEmail: string, product: any, history?: any[]) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "updates@propricetracker.com",
      to: userEmail,
      subject: `🚨 ALL-TIME LOW: ${product.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #3b82f6; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: white; margin: 0;">Lowest Price Ever Recorded! 📉</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Hey, <strong>${product.name}</strong> has reached its lowest price ever!</p>
              ${product.image_url ? `<div style="text-align: center;"><img src="${product.image_url}" alt="Product" style="max-width: 200px; border-radius: 8px;" /></div>` : ""}
              <p style="font-size: 24px; color: #3b82f6; font-weight: bold; text-align: center;">${product.currency} ${product.current_price}</p>
              <p style="text-align: center;">Don't miss this historic drop!</p>
              
              ${
                history && history.length > 0 
                  ? `<div style="text-align: center; margin-top: 20px; margin-bottom: 20px;">
                       <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Price History</h3>
                       <img src="${generateChartUrl(history)}" alt="Price History Chart" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb;" />
                     </div>`
                  : ""
              }

              <div style="text-align: center; margin-top: 20px;">
                <a href="${product.url}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Grab It Now</a>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    if (error) return { error };
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function sendThresholdMetAlert(userEmail: string, product: any, discountPercentage: number) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "updates@propricetracker.com",
      to: userEmail,
      subject: `💥 MASSIVE ${discountPercentage}% DISCOUNT on ${product.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ef4444; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: white; margin: 0;">Massive Discount Alert! 💥</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Hey, <strong>${product.name}</strong> is now available at a huge <strong>${discountPercentage}% discount</strong>!</p>
              ${product.image_url ? `<img src="${product.image_url}" alt="Product" style="max-width: 200px; border-radius: 8px;" />` : ""}
              <p style="font-size: 24px; color: #ef4444; font-weight: bold;">Now only: ${product.currency} ${product.current_price}</p>
              <p>Grab it right away before the sale ends.</p>
              <a href="${product.url}" style="display: inline-block; background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Shop the Deal</a>
            </div>
          </body>
        </html>
      `,
    });
    if (error) return { error };
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

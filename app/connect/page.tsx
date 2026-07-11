"use client";

import { useState, useEffect } from "react";
import { saveWebhookUrl, getWebhookUrl } from "@/app/actions";

export default function ConnectPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadWebhook() {
      const res = await getWebhookUrl();
      if (res.success && res.webhookUrl) {
        setWebhookUrl(res.webhookUrl);
      }
    }
    loadWebhook();
  }, []);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage("");
    
    try {
      const res = await saveWebhookUrl(webhookUrl);
      if (res.success) {
        setMessage("Webhook URL saved successfully!");
      } else {
        setMessage(res.error || "Failed to save webhook URL.");
      }
    } catch (error) {
      setMessage("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-6 max-w-[1400px] mx-auto">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-ink">
            Integrations & Connect
          </h1>
          <p className="text-lg text-ink-soft">
            Power up your ProPriceTracker experience by connecting it to your favorite automation tools and AI agents.
          </p>
        </div>

        {/* Webhooks Section */}
        <div className="bg-surface-2 border border-line/60 rounded-3xl p-8 md:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-ink">Webhook Subscriptions</h2>
              <p className="text-ink-soft leading-relaxed">
                Receive instant JSON payloads whenever a price drops. Perfect for triggering automations in Zapier, Make.com, or posting directly to a Discord channel.
              </p>
            </div>

            <form onSubmit={handleSaveWebhook} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="webhook" className="text-sm font-medium text-ink-muted">
                  Your Webhook URL
                </label>
                <input
                  id="webhook"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-background border border-line/60 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-ink"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-full bg-ink text-background font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Webhook"}
                </button>
                {message && (
                  <p className={`text-sm ${message.includes("success") ? "text-emerald-500" : "text-rose-500"}`}>
                    {message}
                  </p>
                )}
              </div>
            </form>

            <div className="pt-4 border-t border-line/40">
              <h4 className="text-sm font-semibold mb-2">Example Payload:</h4>
              <pre className="bg-background border border-line/60 rounded-xl p-4 text-xs font-mono text-ink-soft overflow-x-auto">
{`{
  "event": "price_drop",
  "alerts": [
    {
      "productName": "Apple iPhone 15 Pro",
      "oldPrice": 999.00,
      "newPrice": 899.00,
      "url": "https://amazon.com/..."
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* MCP Server Section */}
        <div className="bg-surface-2 border border-line/60 rounded-3xl p-8 md:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"></rect>
              <path d="M7 7h.01"></path>
              <path d="M17 7h.01"></path>
              <path d="M7 17h.01"></path>
              <path d="M17 17h.01"></path>
              <path d="M12 12h.01"></path>
            </svg>
          </div>

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-ink">MCP Server (Model Context Protocol)</h2>
              <p className="text-ink-soft leading-relaxed">
                ProPriceTracker exposes a native MCP endpoint. This allows AI Agents (like Claude Desktop or Cursor) to securely connect to your database, read price history, and track new products autonomously.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-ink-muted">Connection Endpoint</h3>
                <div className="flex items-center gap-2 bg-background border border-line/60 rounded-xl p-3">
                  <code className="text-sm text-ink flex-1 truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'https://yourdomain.com/api/mcp'}
                  </code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'https://yourdomain.com/api/mcp');
                      alert('Copied to clipboard!');
                    }}
                    className="p-2 hover:bg-surface-3 rounded-lg transition-colors text-ink-soft"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-ink-muted">Available Tools</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-background border border-line/40 rounded-xl p-4">
                    <div className="font-mono text-sm font-semibold text-accent mb-1">track_product</div>
                    <p className="text-xs text-ink-soft">Initiate a scrape for a given Amazon URL.</p>
                  </div>
                  <div className="bg-background border border-line/40 rounded-xl p-4">
                    <div className="font-mono text-sm font-semibold text-accent mb-1">get_price_history</div>
                    <p className="text-xs text-ink-soft">Retrieve 90-day price trends for a product.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

# ProPriceTracker - Advanced E-Commerce Price Monitor

**Live Demo:** [https://buykarley.vercel.app](https://buykarley.vercel.app)

ProPriceTracker is an intelligent and automated price tracking application that allows users to monitor product prices across various e-commerce platforms. Built with a modern Next.js stack, it uses native custom scrapers for Flipkart & Myntra (via their internal APIs), ScrapingAnt for Amazon, Supabase for scalable backend operations, and Resend for transactional email alerts.

## Key Features

- **Universal Tracking:** Monitor items from Amazon (using ScrapingAnt) and other sites like BestBuy, Zara, Walmart (via Firecrawl).
- **Detailed Amazon Metadata:** Extracts and displays star ratings, review counts, popularity scores, choice badges, ASIN numbers, and collapsible features/descriptions.
- **Price Trends & Alerts:** Visualize history with interactive charts, toggle price alerts, and receive email notifications on price drops.
- **Signalist Trading Desk:** Build "Dream Setups" (Portfolios) with real-time price tracking. Includes technical indicators like Moving Average, Volatility %, Sentiment Scores, and "Buy/Wait" signals for products.
- **Real-time Flashes:** UI instantly flashes green or red via Supabase WebSockets the moment a price changes in the backend.
- **Serverless AI Assistant:** A built-in AI chat that uses natural language processing (`sentiment` package) to analyze your questions, combining your emotional tone with historical price averages to give personalized "Buy Now" or "Wait" signals. Pure TypeScript, no Python backend required!
- **Hero Carousel:** Beautiful interactive product showcase on the landing page.
- **Dynamic Auth / Dev Bypass:** Secure Google OAuth integration, with a built-in `BYPASS_AUTH` toggle for frictionless local sandbox testing.
- **Automated Checks:** Daily cron jobs check tracked products and notify users of drop alerts.
- **Export to PDF:** Easily generate and download a clean PDF report containing all tracked products, their descriptions, and thumbnail images.
- **Location-Based Delivery Details:** Enter a specific Pincode for any Amazon product directly on its card to fetch accurate, real-time Delivery Dates and "Sold By" merchant data.
- **Multi-Tenant Scaling Optimization:** Products are stored globally unique in the database and mapped to users, reducing total scraping calls and database bloat by over 90%.
- **API Rate Limiting Protection:** Integrated `@upstash/ratelimit` via Upstash Redis to restrict spam requests on product tracks and organic search routes.
- **Google Shopping Search:** Users can search products by name directly via SerpAPI instead of pasting raw URLs, tracking matching items instantly.
- **Day 1 Price History Syncer:** Crawls Google for a product's PriceHistoryApp slug on Day 1, parsing and bulk-saving the last 90 days of historical date-price data into your database.
- **PriceHistoryApp Embedded Visuals:** Displays the interactive historical graph iframe on product card footers as an additional option.
- **Global Alternative Deals Feed:** Surfaces top discounted items tracked globally by the community at the bottom of the Price Drops page.
- **Resilient Parsers & Cleaners:** Strips messy tracking parameters from URLs and parses international currency symbols (including Indian Lakhs) safely.
- **Smart Notification Decision Engine:** Advanced cron logic that intelligently prioritizes email alerts (e.g., distinguishing an All-Time Low vs. a Target Threshold vs. a standard drop) to prevent notification fatigue.
- **Embedded Email Charts:** Automatically generates and embeds static QuickChart visual graphs of a product's 14-day price history directly inside the email alerts so users never have to leave their inbox.
- **Native Flipkart Scraper:** Dedicated custom scraper (`lib/flipkart-scraper.ts`) using Axios + Cheerio that extracts full product metadata — title, current price, MRP, product image, star rating, review count, seller name, and delivery date — from Flipkart pages without Firecrawl, eliminating 500 timeout errors.
- **Native Myntra Scraper:** Dedicated scraper (`lib/myntra-scraper.ts`) that calls Myntra's internal product gateway JSON API (`/gateway/v2/product/{id}`) directly, bypassing all anti-bot HTML blocking. Returns rich data including high-res images, discounted price, MRP, seller, and availability status.
- **Smart Platform Router:** `app/actions.tsx` automatically detects the URL domain on product add and routes Amazon → ScrapingAnt, Flipkart → custom native scraper, Myntra → gateway API scraper, and other sites → Firecrawl. Zero manual selection needed.
- **URL Cleaners for All Platforms:** `lib/url-cleaner.ts` strips all tracking/UTM parameters from Amazon, Flipkart, and Myntra URLs, saving canonical versions to the database for accurate de-duplication.
- **Day 1 Price History Bulk Importer:** When a brand-new product is first tracked, the app fetches its slug from `pricehistoryapp.com` via SerpAPI and bulk-imports all historical date-price data into `price_history`, populating the chart from Day 1 for all platforms.
- **Pricewatcha Webhook Integration:** Registers products with Pricewatcha in the background for passive webhook-driven price drop alerts, without blocking the main scrape flow.
- **Resilient Image Extraction:** Multi-layered image extraction with CSS class fallbacks, `og:image` meta fallback, and a generic `img[src]` scan — ensures product images are always saved even when site markup changes.

## Architecture A: Product Tracking Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as ProPriceTracker (Next.js)
    participant S as Supabase (DB & Auth)
    participant SA as ScrapingAnt (Amazon Scraper)
    participant FK as Flipkart Native Scraper
    participant MY as Myntra Gateway API
    participant F as Firecrawl (General Scraper)
    participant PW as Pricewatcha (Webhooks)
    participant E as E-Commerce Site

    U->>A: Adds Product URL
    alt is Amazon URL (or amzn. link)
        A->>SA: Request details (with regional proxies)
        SA->>E: Fetch page
        E-->>SA: HTML Content
        SA-->>A: Rich Metadata (ASIN, rating, choice, desc)
    else is Flipkart URL
        A->>FK: Axios + Cheerio scrape
        FK->>E: Fetch Flipkart page
        E-->>FK: HTML Content
        FK-->>A: Title, Price, Image, Seller, Delivery
    else is Myntra URL
        A->>MY: Call /gateway/v2/product/{id}
        MY-->>A: JSON (Price, Images, Seller, Rating)
    else is Other Store
        A->>F: Request extraction
        F->>E: Fetch page
        F-->>A: Basic Data (Price, Name, Image)
    end
    A->>S: Store Product & Price History
    A->>PW: Register webhook (background, non-blocking)
    S-->>A: Confirm Storage
    A-->>U: Render Dashboard Card
```

## Architecture B: Daily Cron Alerts Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as ProPriceTracker (Next.js)
    participant S as Supabase (DB & Auth)
    participant SA as ScrapingAnt (Amazon Scraper)
    participant R as Resend (Email)
    
    Note over S,SA: Daily Cron Job Flow
    S->>A: Trigger /api/cron/check-prices
    A->>SA: Scrape updated prices (per platform)
    SA-->>A: New Prices
    A->>S: Update DB & History
    alt Price Dropped & Alerts Enabled
        A->>R: Trigger Email Alert (with embedded chart)
        R-->>U: Price Drop Notification
    end
```

## Signalist Trading Desk (`/signalist`)

The **Signalist Trading Desk** is an advanced sub-module designed for users who want to group products into logical tracking portfolios (e.g., "Gaming PC Build", "Smart Home Upgrades") and monitor their aggregate value with algorithmic trading indicators.

### Desk Features:
- **Dream Setups (Portfolios):** Create unlimited, named portfolios and attach products to them. The card instantly calculates and displays the total aggregated cost of the setup.
- **Instant Product Syncing:** Add tracked products from a dropdown, or paste a brand-new Amazon URL directly into the setup. The app will automatically scrape it, track it, and wire it into the setup without needing a page refresh.
- **Optimistic UI:** Products can be removed from portfolios instantly via a hover-action minus button. The UI updates optimistically while the server processes the deletion.
- **Real-Time Flashes (WebSockets):** Using Supabase Realtime channels, the Trading Desk listens for database-level price updates. The moment a price changes (via a cron job or manual refresh), the `Total Value` of the setup and the individual product cards briefly flash **Green** (for price drops) or **Red** (for price increases) for 3 seconds.
- **Technical Analysis Indicators:**
  - **Moving Average (30-day):** Calculates the recent price trend to determine if the current price is a good entry point.
  - **Volatility Index:** A percentage metric showing how heavily the product's price fluctuates.
  - **AI Signals:** Automatically labels each product with actionable advice: `Strong Buy`, `Wait`, or `Neutral` based on the delta between the current price and its moving average.

## Technology Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Next.js Server Actions & API Routes, Supabase (PostgreSQL, pg_cron), Upstash Redis (Rate Limiting via `@upstash/ratelimit`), SerpAPI (Shopping Search client)
- **Side-by-Side Product Comparison**: Select up to 3 products to compare their prices, ratings, and features simultaneously using a persistent Zustand store.
- **Signalist Trading Desk**: Build custom portfolios and get live AI-driven "Buy/Wait" signals, complete with optimistic instant UI updates for adding/removing items.
- **Deep Discount Dashboard**: A dedicated interface that exclusively surfaces items currently on sale, sorted by the highest discount percentage.
- **Sales Calendar & Savings Predictor**: An interactive tool that calculates potential savings by delaying purchases until major upcoming e-commerce events (e.g., Prime Day, Black Friday).
- **Intelligent "Product Details" Parser**: Automatically scrapes the "Technical Details" section from Amazon into a structured JSON map (Key-Value pairs), stripping out messy HTML and emojis.
- **Command Palette (⌘K)**: Instantly jump between features using the global `cmdk` search menu.
- **PDF Generation**: Uses `pdfkit` to generate rich, well-formatted PDF reports of tracked products directly from the API routes.
- **Location-Aware Scraping**: Injects a base64-encoded JS snippet into the ScrapingAnt engine to interact with Amazon's location popover, enabling accurate extraction of region-specific delivery data.
- **Extraction APIs:** 
  - **ScrapingAnt Client:** Advanced Amazon scraper using regional proxy routing (US, IN, GB, DE, FR, JP) and automatic bot-detection bypass.
  - **Firecrawl Client:** General e-commerce scraper for other sites.
- **Notifications:** Resend (Email Delivery)

## Full Folder Structure

```text
ProPriceTracker/
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore rules
├── components.json               # shadcn/ui configuration
├── eslint.config.mjs             # ESLint configuration
├── migrate.js                    # DB migration script to add ratings, reviews, alerts columns
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── package-lock.json             # Locked dependency versions
├── postcss.config.mjs            # PostCSS configuration
├── proxy.ts                      # Next.js proxy
├── README.md                     # Project documentation
├── tsconfig.json                 # TypeScript configuration
├── app/                          # Next.js App Router root
│   ├── layout.tsx                # Root layout (supports auth bypass)
│   ├── page.tsx                  # Dashboard product list
│   ├── actions.tsx               # Server actions (DB, toggleAlerts, mockUser helpers)
│   ├── error/
│   │   └── page.tsx              # Error page
│   ├── auth/
│   │   └── callback/
│   │       └── route.tsx         # OAuth callback handler
│   ├── compare/
│   │   └── page.tsx              # Amazon search comparison layout
│   └── api/
│       ├── cron/
│       │   └── check-prices/
│       │       └── route.tsx     # Cron endpoint for price checking & Resend alerts
│       └── update-products/
│           └── route.ts          # Migration endpoint to update existing DB rows
├── components/                   # Reusable React components
│   ├── AddProductForm.tsx        # Form to submit new product URLs
│   ├── AuthButton.tsx            # Login/Logout button
│   ├── AuthModal.tsx             # Authentication modal dialog
│   ├── CompareClient.tsx         # Interactive comparison interface
│   ├── PriceChart.tsx            # Recharts-powered price history & alert button
│   ├── ProductCard.tsx           # Product display card with score, ASIN, features toggler
│   └── ui/                       # shadcn/ui generic components
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       └── sonner.tsx
├── lib/                          # Core business logic and integrations
│   ├── email.ts                  # Resend email templates and logic
│   ├── firecrawl.ts              # Firecrawl API scraper integration
│   ├── amazon-scraper.ts         # Amazon detail scraper using ScrapingAnt & URL canonical cleaner
│   ├── amazon-search-scraper.ts  # Amazon search-list scraper for comparison views
│   ├── flipkart-scraper.ts       # Native Flipkart scraper (Axios + Cheerio)
│   ├── myntra-scraper.ts         # Myntra scraper via internal gateway JSON API
│   ├── url-cleaner.ts            # URL canonicalizer for Amazon, Flipkart & Myntra
│   ├── pricewatcha.ts            # Pricewatcha webhook registration client
│   ├── price-history-crawler.ts  # Day-1 price history fetcher via SerpAPI + pricehistoryapp.com
│   ├── redis.ts                  # Upstash Redis rate limiting client
│   └── utils.ts                  # Class merger helpers
└── utils/                        # Utilities and Supabase clients
    └── supabase/
        ├── client.ts             # Browser client setup
        ├── middleware.ts         # Session refresh logic
        └── server.ts             # Server-side client setup
```

## Local Development & Testing

### 1. Bypassing Authentication
To run and test the application locally without setting up Google OAuth or signing in:
1. In [actions.tsx](file:///c:/price/ProPriceTracker/app/actions.tsx), set `BYPASS_AUTH = true` (it is set to `false` by default for standard authentication).
2. When active, the application bypasses standard auth. It calls `getMockUser()`, which resolves the first user ID in your database to satisfy PostgreSQL foreign key constraints, and queries Supabase using a service role client to bypass Row-Level Security (RLS) rules.

### 2. Migrating Existing Products
If you have products already tracked in your database that lack rating, review, or description metadata:
1. Run `node migrate.js` to ensure the Supabase schema has all required columns.
2. Start the dev server (`npm run dev`).
3. Visit `http://localhost:3000/api/update-products` in your browser. 
4. The API will perform clean canonical scraping on all your existing rows and save their reviews, ratings, descriptions, and original prices back to the database.

## License
This project is licensed under the **MIT License**. Anyone is completely free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software. Feel free to use this code for personal or commercial projects!

# Project Comparison: ProPriceTracker vs. Zillow Scrapers

This document provides a comparative analysis between the `ProPriceTracker` e-commerce price monitor and two real estate scraping tools: `zillow-price-history-scraper` and `zillow-sold-listings-scraper`.

## 1. Domain & Target Application
*   **ProPriceTracker**: An e-commerce price tracking tool (Amazon, BestBuy, Walmart) designed to help everyday consumers find the best deals on retail products.
*   **Zillow Scrapers**: Real estate data extraction tools designed for investors, analysts, and data scientists looking to analyze housing market trends, track property histories, and find profitable investment opportunities.

## 2. Technology & Architecture
*   **ProPriceTracker**: A full-stack web application built with Next.js, React, and Supabase. Uses APIs like Firecrawl and ScrapingAnt to navigate e-commerce HTML.
*   **Zillow Scrapers**: Primarily Python-based backend scripts.
    *   *Price History Scraper*: Uses a simple `requests`-based script to query the Bright Data API for managed proxy/CAPTCHA handling.
    *   *Sold Listings Scraper*: A custom Python architecture with internal modules (`scraper.py`, `zillow_parser.py`, `price_segmenter.py`) to systematically bypass Zillow's page limitations using price segmentation.

## 3. Data Challenges
*   **ProPriceTracker**: Deals with unstructured e-commerce DOMs and heavily relies on proxy/headless browser services to bypass anti-bot mechanisms on sites like Amazon.
*   **Zillow Scrapers**: Faces severe IP blocking and rate-limiting from Zillow. The *Price History Scraper* outsources this to Bright Data, while the *Sold Listings Scraper* uses custom logic (price segmentation) to access deeper listing pages.

## 4. Key Features
*   **ProPriceTracker**: Includes user-facing features like side-by-side product comparisons, sales calendars, and price drop email alerts (via Resend).
*   **Zillow Scrapers**: Focus solely on data extraction. The *Sold Listings Scraper* extracts highly detailed property attributes (taxes, nearby schools, construction details) and exports them in structured formats (e.g., JSON).

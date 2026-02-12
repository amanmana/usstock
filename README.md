# Bursa Malaysia Rebound Screener

A standalone commercial-grade stock screener for Bursa Malaysia, focusing on rebound strategies. built with Vite, React, Tailwind CSS, Netlify Functions, and Supabase.

## Features

- **Rebound Strategy**: Automatically identifies stocks in uptrend with healthy pullbacks.
- **Scoring System**: Validates candidates with a 0-10 score based on MA20/50/200, RSI, and Volume.
- **Automated Sync**: Scrapes EOD data (Close & Volume) daily via Netlify Scheduled Functions.
- **Dark Mode UI**: Premium, fast-loading interface with interactive elements.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Netlify Functions (Serverless Node.js)
- **Database**: Supabase (PostgreSQL)
- **Scheduling**: Netlify Cron

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Netlify CLI (`npm install -g netlify-cli`)
- Supabase Project

### 2. Environment Variables
Create a `.env` file in the root directory (for local dev) and configure in Netlify Dashboard:

```ini
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (Backend only)

# Scraper Configuration
SCRAPER_BASE_URL=https://klse.i3investor.com/servlets/stk/
```

### 3. Database Migration
Run the SQL file located in `supabase/migrations/20260209000000_initial_schema.sql` in your Supabase SQL Editor to create tables and RLS policies.

### 4. Running Locally

**Install Dependencies:**
```bash
npm install
```

**Run with Netlify Dev (Recommended for Functions support):**
```bash
netlify dev
```
Access the app at `http://localhost:8888`.

**Run Frontend Only:**
```bash
npm run dev
```

### 5. Deployment
Push to GitHub and connect to Netlify. The `netlify.toml` file handles build configuration and scheduled functions.

## Scraper Configuration
The scraper logic is located in `netlify/functions/utils/scraper.js`.
By default, it uses a **Mock Data Generator** to demonstrate functionality without hitting external rate limits or blocks.
To enable real scraping:
1. Open `netlify/functions/syncBatch.js`
2. Uncomment `const data = await fetchStockData(stock.ticker_code);`
3. Comment out the mock data line.
4. Ensure `utils/scraper.js` selectors match the target website structure.

## Scheduled Sync
The sync job runs daily at **18:10 MYT**. You can also trigger a manual sync via the "Sync EOD" button in the UI.

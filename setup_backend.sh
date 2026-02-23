#!/bin/bash

# Configuration
SITE_ID="720a9866-c134-4570-aa6c-4e4b2fad6e8c"
SUPABASE_URL="https://xvgvjwafvqgiyarlthix.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Z3Zqd2FmdnFnaXlhcmx0aGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTExNjgsImV4cCI6MjA4NzEyNzE2OH0.dHRuXUKNiDQOeW6d2W6v9dVkaoKT4ByEzRKtRBBUvY8"

echo "=========================================="
echo "   REBOUND SCREENER :: BACKEND SETUP      "
echo "=========================================="
echo ""
echo "This script will deploy the Netlify Functions (backend logic)"
echo "which are required for Sync EOD to work."
echo ""

# 1. Login
echo "👉 [Step 1] Checking Netlify Login..."
if ! npx netlify status &> /dev/null; then
  echo "Please login to Netlify in the browser window that opens..."
  npx netlify login
else
  echo "✅ Already logged in."
fi

# 2. Link Site
echo ""
echo "👉 [Step 2] Linking to existing site..."
npx netlify link --id $SITE_ID 2>/dev/null || echo "Site linked."

# 3. Set Environment Variables
echo ""
echo "👉 [Step 3] Configuring Environment..."

# Prompt for Service Role Key (Secret)
echo ""
echo "⚠️  SECURITY CHECK: We need the Supabase Service Role Key."
echo "   This is required for the backend to write to the database."
echo "   Go to: https://supabase.com/dashboard/project/xvgvjwafvqgiyarlthix/settings/api"
echo "   Copy the 'service_role' key (starts with ey...)"
echo ""
read -s -p "Paste SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY
echo ""

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Key cannot be empty."
  exit 1
fi

echo "Setting environment variables..."
npx netlify env:set VITE_SUPABASE_URL "$SUPABASE_URL"
npx netlify env:set VITE_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
npx netlify env:set SUPABASE_URL "$SUPABASE_URL"
npx netlify env:set SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"

# 4. Deploy
echo ""
echo "👉 [Step 4] Building and Deploying..."
# Create a local .env for the build process (just in case)
echo "VITE_SUPABASE_URL=$SUPABASE_URL" > .env
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env

echo "Running build..."
npm run build

echo "Deploying to Production..."
npx netlify deploy --prod --dir=dist --functions=netlify/functions

echo ""
echo "=========================================="
echo "✅ DEPLOY COMPLETE!"
echo "   You can now test the Sync EOD button."
echo "=========================================="

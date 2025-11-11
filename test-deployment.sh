#!/bin/bash

# Test script for Vercel deployment
# Usage: ./test-deployment.sh https://your-project.vercel.app

if [ -z "$1" ]; then
  echo "Usage: $0 <vercel-url>"
  echo "Example: $0 https://madrid-o3-demo.vercel.app"
  exit 1
fi

URL="$1"

echo "=========================================="
echo "Testing Madrid O3 Demo Deployment"
echo "URL: $URL"
echo "=========================================="
echo ""

echo "1. Testing Ingest Endpoint..."
INGEST_RESPONSE=$(curl -s "$URL/api/madrid/ingest")
echo "$INGEST_RESPONSE" | jq '{success, status, stations_count, data_age_minutes}' 2>/dev/null || echo "$INGEST_RESPONSE"
echo ""

sleep 2

echo "2. Testing Status Endpoint..."
STATUS_RESPONSE=$(curl -s "$URL/api/madrid/status")
echo "$STATUS_RESPONSE" | jq '{status, max_1h: .max_1h.value, stations_count: (.stations | length), data_age_minutes}' 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

echo "3. Testing Status JSON Route..."
STATUS_JSON=$(curl -s "$URL/madrid/status.json")
echo "$STATUS_JSON" | jq '{status, max_1h: .max_1h.value, stations_count: (.stations | length)}' 2>/dev/null || echo "$STATUS_JSON"
echo ""

echo "4. Testing PDF Endpoint..."
PDF_HEADERS=$(curl -I -s "$URL/api/madrid/latest.pdf")
echo "$PDF_HEADERS" | head -5
echo ""

echo "5. Testing Changelog..."
CHANGELOG=$(curl -s "$URL/api/madrid/changelog")
CHANGELOG_LENGTH=$(echo "$CHANGELOG" | jq 'length' 2>/dev/null || echo "0")
echo "Changelog entries: $CHANGELOG_LENGTH"
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open $URL/madrid in your browser"
echo "2. Check Vercel Dashboard → Functions → Logs for any errors"
echo "3. Verify cron job is enabled in Vercel Dashboard → Settings → Cron Jobs"
echo ""


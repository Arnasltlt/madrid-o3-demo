# Deployment Verification Checklist

## Quick Verification Steps

### 1. Test Ingest Endpoint
```bash
curl https://your-project.vercel.app/api/madrid/ingest
```

**Expected:** JSON response with:
- `success: true`
- `status: "COMPLIANT"` or `"INFO_EXCEEDED"`
- `stations_count: > 0`
- `data_age_minutes: < 200`

### 2. Test Status Endpoint
```bash
curl https://your-project.vercel.app/api/madrid/status
```

**Expected:** JSON response with:
- `status: "COMPLIANT"` or `"INFO_EXCEEDED"`
- `max_1h.value: number`
- `stations: array` with station data
- `data_age_minutes: number`

**Note:** If you get `503 No data available`, run the ingest endpoint first.

### 3. Test Health Endpoint
```bash
curl https://your-project.vercel.app/api/health
```

**Expected:** JSON response with:
- `status: "ok"`
- `version` matching `package.json`
- `timestamp` (ISO string)
- `commit` populated when deployed from Git

### 4. Test Status JSON Route
```bash
curl https://your-project.vercel.app/madrid/status.json
```

**Expected:** Contract v1 payload with frozen fields listed in the review.

### 5. Test Main Page
Open in browser:
```
https://your-project.vercel.app/madrid
```

**Expected:** 
- Page loads with Madrid O3 dashboard
- Status badge displays
- Station table shows data
- "Descargar PDF" button works

### 6. Test Latest PDF
```bash
curl -I https://your-project.vercel.app/api/madrid/latest.pdf
```

**Expected:** 
- `Content-Type: application/pdf`
- Status `200 OK` (or `503` if no data - run ingest first)

### 7. Test Episodes Feed
```bash
curl https://your-project.vercel.app/api/madrid/episodes
```

**Expected:** JSON array of past `INFO_EXCEEDED` episodes with `pdf_url` links.

### 8. Test Changelog
```bash
curl https://your-project.vercel.app/api/madrid/changelog
```

**Expected:** JSON array of status change events.

### 9. Test Methodology Page
Open in browser:
```
https://your-project.vercel.app/madrid/methodology
```

**Expected:** Methodology page with data sources and attribution.

## Environment Variables Check

In Vercel Dashboard → Settings → Environment Variables:
- ✅ `EEA_CONTACT_EMAIL` is set to `arnoldaskem@gmail.com`
- ✅ `SYNTHETIC_MODE_TOKEN` is configured for protected testing (same value in all environments)
- ✅ Applied to Production, Preview, and Development environments

## Cron Job Check

In Vercel Dashboard → Settings → Cron Jobs:
- ✅ Cron job is enabled (runs `/api/madrid/ingest` every 30 minutes)
- ✅ Last run shows recent timestamp

## Common Issues

### Issue: Status endpoint returns "No data available"
**Solution:** The ingest endpoint needs to run first. Either:
1. Manually call `/api/madrid/ingest` first
2. Wait for the cron job to run (every 30 minutes)
3. The frontend should handle this automatically

### Issue: Build fails or runtime errors
**Check:**
1. Vercel Dashboard → Deployments → View logs
2. Check function logs for errors
3. Verify `EEA_CONTACT_EMAIL` is set correctly

### Issue: No real data, only mock data
**Check:**
1. Verify `EEA_CONTACT_EMAIL` environment variable is set
2. Check function logs for EEA API errors
3. The app falls back to mock data if EEA API fails (this is expected behavior)

## Synthetic Test Mode

Use the protected query flag to drive deterministic scenarios (replace `<TOKEN>` with the value from `SYNTHETIC_MODE_TOKEN`):

### Trigger an exceedance
```bash
curl "https://your-project.vercel.app/api/madrid/ingest?synthetic=exceed&token=<TOKEN>"
curl "https://your-project.vercel.app/api/madrid/status"
```

### Force recovery (run twice to satisfy debounce)
```bash
curl "https://your-project.vercel.app/api/madrid/ingest?synthetic=recover&token=<TOKEN>"
curl "https://your-project.vercel.app/api/madrid/ingest?synthetic=recover&token=<TOKEN>"
curl "https://your-project.vercel.app/api/madrid/status"
```

### Preview without mutating state
```bash
curl "https://your-project.vercel.app/api/madrid/status?synthetic=exceed&token=<TOKEN>"
```

## Full Test Script

Save this as `test-deployment.sh` and run with your Vercel URL:

```bash
#!/bin/bash
URL="https://your-project.vercel.app"
TOKEN="${TOKEN:-set-your-synthetic-token}"

echo "Testing Ingest Endpoint..."
curl -s "$URL/api/madrid/ingest" | jq '{success, status, stations_count, data_age_minutes}'

echo -e "\n\nTesting Status Endpoint..."
curl -s "$URL/api/madrid/status" | jq '{status, max_1h: .max_1h.value, stations_count: (.stations | length), data_age_minutes}'

echo -e "\n\nTesting Status JSON Route..."
curl -s "$URL/madrid/status.json" | jq '{status, o3_max_1h_ugm3, stations_count: (.stations | length)}'

echo -e "\n\nTesting Health Endpoint..."
curl -s "$URL/api/health" | jq '{status, version, commit}'

echo -e "\n\nTesting Latest PDF..."
curl -I "$URL/api/madrid/latest.pdf" | head -5

echo -e "\n\nTesting Episodes Feed..."
curl -s "$URL/api/madrid/episodes" | jq 'length'

echo -e "\n\nTesting Changelog..."
curl -s "$URL/api/madrid/changelog" | jq 'length'

echo -e "\n\nSynthetic Exceedance Preview..."
curl -s "$URL/api/madrid/status?synthetic=exceed&token=$TOKEN" | jq '{status, synthetic_mode}'
```

Run with:
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```

## Success Criteria

✅ All endpoints return expected responses  
✅ Real Madrid O3 data is being fetched (not just mock data)  
✅ Frontend displays correctly  
✅ PDF generation works  
✅ Cron job is running automatically  
✅ No errors in Vercel function logs  


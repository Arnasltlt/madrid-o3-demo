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

### 3. Test Status JSON Route
```bash
curl https://your-project.vercel.app/madrid/status.json
```

**Expected:** Same as status endpoint above.

### 4. Test Main Page
Open in browser:
```
https://your-project.vercel.app/madrid
```

**Expected:** 
- Page loads with Madrid O3 dashboard
- Status badge displays
- Station table shows data
- "Descargar PDF" button works

### 5. Test PDF Generation
```bash
curl -I https://your-project.vercel.app/api/madrid/latest.pdf
```

**Expected:** 
- `Content-Type: application/pdf`
- Status `200 OK` (or `503` if no data - run ingest first)

### 6. Test Changelog
```bash
curl https://your-project.vercel.app/api/madrid/changelog
```

**Expected:** JSON array of status change events.

### 7. Test Methodology Page
Open in browser:
```
https://your-project.vercel.app/madrid/methodology
```

**Expected:** Methodology page with data sources and attribution.

## Environment Variables Check

In Vercel Dashboard → Settings → Environment Variables:
- ✅ `EEA_CONTACT_EMAIL` is set to `arnoldaskem@gmail.com`
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

## Full Test Script

Save this as `test-deployment.sh` and run with your Vercel URL:

```bash
#!/bin/bash
URL="https://your-project.vercel.app"

echo "Testing Ingest Endpoint..."
curl -s "$URL/api/madrid/ingest" | jq '{success, status, stations_count, data_age_minutes}'

echo -e "\n\nTesting Status Endpoint..."
curl -s "$URL/api/madrid/status" | jq '{status, max_1h: .max_1h.value, stations_count: (.stations | length), data_age_minutes}'

echo -e "\n\nTesting Status JSON Route..."
curl -s "$URL/madrid/status.json" | jq '{status, max_1h: .max_1h.value, stations_count: (.stations | length)}'

echo -e "\n\nTesting PDF Endpoint..."
curl -I "$URL/api/madrid/latest.pdf" | head -5

echo -e "\n\nTesting Changelog..."
curl -s "$URL/api/madrid/changelog" | jq 'length'
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


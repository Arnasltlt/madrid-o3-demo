# Deployment Guide

## Prerequisites

- Vercel account (free tier works)
- GitHub repository (optional, for automatic deployments)

## Deployment Steps

### 1. Build Verification

Before deploying, verify the build works locally:

```bash
npm run build
```

This should complete without errors.

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? madrid-o3-demo (or your choice)
# - Directory? ./
# - Override settings? No
```

#### Option B: Using GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Configure Environment Variables

In the Vercel dashboard:

1. Go to your project → Settings → Environment Variables
2. Add:
   - **Name**: `EEA_CONTACT_EMAIL`
   - **Value**: `arnoldaskem@gmail.com` (or your email)
   - **Environment**: Production, Preview, Development (select all)

### 4. Enable Cron Job (Optional)

The `vercel.json` file includes a cron job configuration:

```json
{
  "crons": [
    {
      "path": "/api/madrid/ingest",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

This runs the ingest endpoint every 30 minutes to keep data fresh.

To enable:
1. Go to Vercel dashboard → Your Project → Settings → Cron Jobs
2. The cron job should be automatically detected from `vercel.json`
3. Enable it if needed

### 5. Verify Deployment

After deployment, test these endpoints:

1. **Ingest endpoint**:
   ```
   https://your-project.vercel.app/api/madrid/ingest
   ```
   Should return: `{"success": true, "status": "COMPLIANT", ...}`

2. **Status endpoint**:
   ```
   https://your-project.vercel.app/api/madrid/status
   ```
   Should return current status with station data

3. **Main page**:
   ```
   https://your-project.vercel.app/madrid
   ```
   Should display the dashboard with real Madrid O3 data

4. **PDF generation**:
   ```
   https://your-project.vercel.app/madrid/latest.pdf
   ```
   Should download a PDF notice

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **TypeScript errors**: Run `npm run build` locally to see detailed errors
2. **Missing dependencies**: Ensure all packages are in `package.json`
3. **Environment variables**: Make sure `EEA_CONTACT_EMAIL` is set in Vercel

### Runtime Errors

If the app runs but has issues:

1. **Check Vercel logs**: Dashboard → Your Project → Functions → View logs
2. **Verify API endpoints**: Test `/api/madrid/ingest` directly
3. **Check data parsing**: Look for errors related to Parquet parsing

### Data Issues

If no real data appears:

1. **Check EEA API status**: The API might be temporarily unavailable
2. **Verify email**: Ensure `EEA_CONTACT_EMAIL` is set correctly
3. **Check fallback**: The app should fall back to mock data if real data fails

## Post-Deployment

After successful deployment:

1. **Monitor cron job**: Ensure it's running every 30 minutes
2. **Check data freshness**: Verify `/api/madrid/status` shows recent data
3. **Test threshold detection**: When O3 levels exceed 180 µg/m³, status should change
4. **Monitor logs**: Watch for any errors in Vercel function logs

## Production Checklist

- [ ] Build completes successfully
- [ ] Environment variables configured
- [ ] Cron job enabled (optional)
- [ ] Ingest endpoint returns real data
- [ ] Status endpoint works
- [ ] Main page displays correctly
- [ ] PDF generation works
- [ ] Data updates automatically (if cron enabled)


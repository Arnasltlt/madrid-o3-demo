# Madrid O3 Information Threshold Demo

A Next.js application that monitors ozone levels in Madrid and generates regulatory notices when the information threshold (180 µg/m³) is exceeded.

## Features

- Real-time monitoring of O3 levels in Aglomeración de Madrid
- Automatic detection of information threshold exceedance
- Generation of Annex-style notices in Spanish
- PDF export functionality
- Machine-readable status API

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Vercel deployment
- EEA Air Quality APIs

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. **Configure EEA API** (for real data):
   - The EEA Air Quality API requires **no authentication** - just an email
   - Create `.env.local`:
     ```bash
     EEA_CONTACT_EMAIL=your-email@example.com
     ```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

**Note**: The app uses real EEA API data by default. If the API fails, it falls back to mock data for testing.

## EEA API Configuration

The application uses the **official EEA Air Quality Download Service API** which provides hourly up-to-date (E2a) station data.

### API Endpoint

**Base URL**: `https://eeadmz1-downloads-api-appservice.azurewebsites.net/`

**Swagger Documentation**: https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html

### Endpoint Used

**POST `/ParquetFile`** - Downloads a ZIP file containing Parquet files (one per station).

**Request Body**:
```json
{
  "countries": ["ES"],
  "cities": ["Madrid"],
  "pollutants": ["O3"],
  "dataset": 1,
  "dateTimeStart": "2025-11-09T00:00:00Z",
  "dateTimeEnd": "2025-11-11T00:00:00Z",
  "aggregationType": "hour",
  "email": "your-email@example.com"
}
```

**Parameters**:
- `countries`: ISO country codes (e.g., `["ES"]`)
- `cities`: Case-sensitive city names (e.g., `["Madrid"]`)
- `pollutants`: Pollutant codes (e.g., `["O3"]`)
- `dataset`: `1` = Up-To-Date (E2a), `2` = Verified (E1a), `3` = AirBase 2002–2012
- `dateTimeStart` / `dateTimeEnd`: UTC ISO 8601 timestamps
- `aggregationType`: `"hour"` | `"day"` | `"variable"`
- `email`: Contact email (required, but no authentication needed)

**Response**: ZIP file containing Parquet files

### Data Format

Each Parquet file contains hourly O3 measurements for one station with fields:
- `AirQualityStationEoICode`: Station identifier
- `AirQualityStationName`: Station name
- `DatetimeBegin`: Start timestamp (UTC)
- `Concentration`: Measured value in µg/m³
- `UnitOfMeasurement`: Unit (e.g., "µg/m³")

### Notes

- **No Authentication Required**: The API is publicly accessible
- **Email Required**: The `email` field is required in requests but is only used for contact purposes
- **Large Files**: If response >600MB, use `/ParquetFile/async` endpoint
- **Rate Limits**: No documented rate limits, but be respectful of the service

### References

- API Documentation: https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html
- EEA Air Quality Database: https://www.eea.europa.eu/data-and-maps/data/air-quality-database

## Deployment to Vercel

### Prerequisites

- Vercel account (free tier works)
- GitHub repository (optional, for automatic deployments)

### Deployment Steps

1. **Build Verification**

   Before deploying, verify the build works locally:
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**

   **Option A: Using Vercel CLI**
   ```bash
   # Install Vercel CLI (if not already installed)
   npm i -g vercel
   
   # Deploy
   vercel
   ```

   **Option B: Using GitHub Integration**
   - Push your code to GitHub
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure Framework Preset: Next.js

3. **Configure Environment Variables**

   In the Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add `EEA_CONTACT_EMAIL` with your email address
   - Apply to Production, Preview, and Development environments

4. **Enable Cron Job** (Optional)

   The `vercel.json` file includes a cron job that runs `/api/madrid/ingest` every 30 minutes.
   
   To enable:
   - Go to Vercel dashboard → Your Project → Settings → Cron Jobs
   - The cron job should be automatically detected from `vercel.json`
   - Enable it if needed

5. **Verify Deployment**

   Test these endpoints after deployment:

   - **Ingest endpoint**: `https://your-project.vercel.app/api/madrid/ingest`
     - Expected: `{"success": true, "status": "COMPLIANT", ...}`
   
   - **Status endpoint**: `https://your-project.vercel.app/api/madrid/status`
     - Expected: Current status with station data
   
   - **Main page**: `https://your-project.vercel.app/madrid`
     - Expected: Dashboard with Madrid O3 data
   
   - **PDF generation**: `https://your-project.vercel.app/madrid/latest.pdf`
     - Expected: PDF notice download

   Additional endpoints to verify:
   - `/api/health` - Health check endpoint
   - `/madrid/status.json` - Machine-readable status contract
   - `/api/madrid/episodes` - Past exceedance episodes
   - `/api/madrid/changelog` - Status change events
   - `/madrid/methodology` - Methodology page

### Troubleshooting

**Build Errors**
- Run `npm run build` locally to see detailed errors
- Ensure all packages are in `package.json`
- Verify `EEA_CONTACT_EMAIL` is set in Vercel

**Runtime Errors**
- Check Vercel logs: Dashboard → Your Project → Functions → View logs
- Verify API endpoints: Test `/api/madrid/ingest` directly
- Check data parsing: Look for errors related to Parquet parsing

**Data Issues**
- Check EEA API status: The API might be temporarily unavailable
- Verify email: Ensure `EEA_CONTACT_EMAIL` is set correctly
- Check fallback: The app falls back to mock data if real data fails

**Status endpoint returns "No data available"**
- The ingest endpoint needs to run first
- Manually call `/api/madrid/ingest` first
- Wait for the cron job to run (every 30 minutes)

### Production Checklist

- [ ] Build completes successfully
- [ ] Environment variables configured
- [ ] Cron job enabled (optional)
- [ ] Ingest endpoint returns real data
- [ ] Status endpoint works
- [ ] Main page displays correctly
- [ ] PDF generation works
- [ ] Data updates automatically (if cron enabled)

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/lib` - Core business logic (data fetching, status computation)
- `/types` - TypeScript type definitions
- `/scripts` - Utility scripts (e.g., contract validation)


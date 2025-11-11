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
   - See `EEA_API_INFO.md` for API details
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

## Deployment to Vercel

1. **Build the project** (verify it works):
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**:
   ```bash
   npx vercel
   ```
   Or connect your GitHub repository to Vercel for automatic deployments.

3. **Set environment variables** in Vercel dashboard:
   - `EEA_CONTACT_EMAIL`: Your email address (e.g., `arnoldaskem@gmail.com`)
   - This email is included in API requests to the EEA API

4. **Configure cron job** (optional):
   - The `vercel.json` file includes a cron job that runs `/api/madrid/ingest` every 30 minutes
   - This ensures data stays fresh
   - Enable it in Vercel dashboard under "Cron Jobs"

5. **Verify deployment**:
   - Check `/api/madrid/ingest` - should return success with real data
   - Check `/api/madrid/status` - should return current status
   - Check `/madrid` - should display the main page with real data

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/lib` - Core business logic (data fetching, status computation)
- `/types` - TypeScript type definitions


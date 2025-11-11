# Quick Start: Getting EEA API Credentials

## TL;DR - Fast Track

1. **Email EEA Support**: Send an email to **data.helpdesk@eea.europa.eu**
   - Subject: "API Access Request for Air Quality Data"
   - Include: Your name, organization, purpose (Madrid O3 monitoring demo)

2. **Wait for Response**: Usually 1-3 business days

3. **Receive Credentials**: You'll get an API key or username/password

4. **Configure**: Create `.env.local` file:
   ```bash
   EEA_API_KEY=your_key_here
   # OR
   EEA_USERNAME=your_username
   EEA_PASSWORD=your_password
   ```

5. **Test**: Restart your dev server and test the `/api/madrid/ingest` endpoint

## Email Template

```
Subject: API Access Request for Air Quality Data

Dear EEA Support Team,

I am requesting API access to the EEA Air Quality Database for a public 
demonstration application that monitors O3 (ozone) information threshold 
exceedances in Madrid, Spain.

Application Details:
- Purpose: Public demo for monitoring O3 threshold (180 µg/m³, 1-hour)
- Data Needed: Hourly O3 data for Madrid agglomeration
- API Endpoints:
  * Zones: https://discomap.eea.europa.eu/map/fme/AirQualityExport.htm
  * Data: https://fme.discomap.eea.europa.eu/fmedatastreaming/AirQualityDownload/AQData_Extract.fmw
- Usage: Read-only, public display
- Update Frequency: Hourly

Contact Information:
- Name: [Your Name]
- Email: [Your Email]
- Organization: [Your Organization]

Thank you for your assistance.

Best regards,
[Your Name]
```

## What Happens Next?

1. **EEA Reviews Your Request** (1-3 business days)
2. **You Receive Credentials** via email
3. **Add Credentials to `.env.local`**
4. **Restart Application** - it will automatically use real data

## Testing Your Credentials

Once you have credentials, test them:

```bash
# Test with API Key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://fme.discomap.eea.europa.eu/fmedatastreaming/AirQualityDownload/AQData_Extract.fmw?CountryCode=ES&CityName=Madrid&Pollutant=O3&Year_from=2024&Month_from=11&Day_from=1&Year_to=2024&Month_to=11&Day_to=10&Source=E2a&OutputFormat=parquet" \
  -o test.zip

# Check if it's a ZIP file (success) or HTML (error)
file test.zip
```

If you get a ZIP file, your credentials work! 🎉

## Need Help?

- **Full Guide**: See `EEA_API_SETUP.md`
- **EEA Support**: data.helpdesk@eea.europa.eu
- **EEA Website**: https://www.eea.europa.eu


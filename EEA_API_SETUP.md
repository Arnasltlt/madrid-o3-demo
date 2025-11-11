# EEA Air Quality API Setup Guide

## Overview
The EEA (European Environment Agency) Air Quality API requires authentication to access real-time data. This guide will help you obtain credentials and configure the application.

## Step 1: Register for EEA API Access

### Option A: Direct Registration (Recommended)
1. **Visit the EEA API Documentation**
   - Go to: https://www.eea.europa.eu/code/api
   - Look for "Air Quality" or "Data Access" sections

2. **Contact EEA Support**
   - Email: **data.helpdesk@eea.europa.eu**
   - Subject: "Request for Air Quality API Access"
   - Include:
     - Your name and organization
     - Purpose of use (e.g., "Public demo for Madrid O3 threshold monitoring")
     - Intended data usage
     - Contact information

3. **Alternative Contact Methods**
   - Check the EEA website for a contact form
   - Look for "API Access Request" or "Developer Resources" sections
   - Visit: https://www.eea.europa.eu/help/contact-us

### Option B: Check Existing Documentation
1. Visit: https://www.eea.europa.eu/data-and-maps/data/air-quality-database
2. Look for "API Access" or "Download" sections
3. Check if there's a self-service registration portal

## Step 2: What Information to Provide

When requesting API access, include:

- **Purpose**: Public demo application for monitoring O3 information threshold in Madrid
- **Data Needed**: Hourly O3 (ozone) data for Madrid agglomeration
- **API Endpoints**:
  - Zones: `https://discomap.eea.europa.eu/map/fme/AirQualityExport.htm`
  - Data: `https://fme.discomap.eea.europa.eu/fmedatastreaming/AirQualityDownload/AQData_Extract.fmw`
- **Usage**: Read-only, public display of air quality status
- **Frequency**: Hourly data updates

## Step 3: Receive Credentials

After approval, you'll typically receive:
- **API Key** (or similar token)
- **Client ID** and **Client Secret** (if using OAuth)
- **Username/Password** (if using basic auth)
- **Documentation** on how to use the credentials

## Step 4: Configure Your Application

### Environment Variables

Create a `.env.local` file in your project root:

```bash
# EEA API Credentials
EEA_API_KEY=your_api_key_here
# OR
EEA_CLIENT_ID=your_client_id
EEA_CLIENT_SECRET=your_client_secret
# OR
EEA_USERNAME=your_username
EEA_PASSWORD=your_password
```

### Authentication Methods

The EEA API may use one of these authentication methods:

1. **API Key in Header**
   ```
   Authorization: Bearer YOUR_API_KEY
   ```

2. **OAuth 2.0**
   - First obtain an access token using Client ID/Secret
   - Then use token in Authorization header

3. **Basic Authentication**
   ```
   Authorization: Basic base64(username:password)
   ```

4. **Query Parameter**
   ```
   ?api_key=YOUR_API_KEY
   ```

## Step 5: Testing

Once you have credentials:

1. Test the API endpoint manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://fme.discomap.eea.europa.eu/fmedatastreaming/AirQualityDownload/AQData_Extract.fmw?CountryCode=ES&CityName=Madrid&Pollutant=O3&Year_from=2024&Month_from=11&Day_from=1&Year_to=2024&Month_to=11&Day_to=10&Source=E2a&OutputFormat=parquet"
   ```

2. Check if you receive a ZIP file (not HTML error)

3. Update the application code with your authentication method

## Step 6: Update Application Code

The application code in `lib/data/eea.ts` will be updated to:
- Read credentials from environment variables
- Add appropriate authentication headers
- Handle authentication errors gracefully

## Troubleshooting

### 401 Unauthorized Error
- Verify credentials are correct
- Check if credentials have expired
- Ensure you're using the correct authentication method
- Contact EEA support if issues persist

### No Response from EEA
- Check if the API endpoint URL is correct
- Verify network connectivity
- Check EEA API status page (if available)

### Wrong Data Format
- Verify API parameters are correct
- Check API documentation for required parameters
- Ensure date ranges are valid

## Alternative: Using Public Data Sources

If API access is delayed, consider:
1. **EEA Data Portal**: https://www.eea.europa.eu/data-and-maps/data/air-quality-database
   - Manual downloads available
   - May have different update frequency

2. **Spanish Air Quality Portal**: 
   - Check if Madrid has a public API
   - May have more direct access

## Next Steps

1. **Request API Access** from EEA (email: data.helpdesk@eea.europa.eu)
2. **Wait for Approval** (typically 1-3 business days)
3. **Receive Credentials** via email
4. **Configure Environment Variables** in `.env.local`
5. **Test Authentication** using curl or Postman
6. **Update Application Code** (I'll help with this once you have credentials)

## Support Contacts

- **EEA Helpdesk**: data.helpdesk@eea.europa.eu
- **EEA Website**: https://www.eea.europa.eu
- **API Documentation**: https://www.eea.europa.eu/code/api

---

**Note**: The application currently uses mock data for testing. Once you have credentials, we'll update the code to use real data from the EEA API.


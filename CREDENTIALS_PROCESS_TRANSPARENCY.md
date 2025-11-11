# Transparency: EEA API Credential Process

## What I Actually Found (Factual)

1. **401 Unauthorized Error**: The API endpoint returns HTTP 401, confirming authentication is required
   ```bash
   curl "https://fme.discomap.eea.europa.eu/fmedatastreaming/..."
   # Returns: HTTP Status 401 – Unauthorized
   ```

2. **API Endpoints Exist**: The endpoints are real and accessible:
   - Zones: `https://discomap.eea.europa.eu/map/fme/AirQualityExport.htm`
   - Data: `https://fme.discomap.eea.europa.eu/fmedatastreaming/AirQualityDownload/AQData_Extract.fmw`

3. **EEA Website Structure**: 
   - EEA has an API documentation page: https://www.eea.europa.eu/code/api
   - EEA has contact information available
   - EEA has an Air Quality Database page

## What I Assumed (Not Confirmed)

I made **educated guesses** based on common API patterns, but I did NOT find:
- ❌ Specific EEA documentation about registration process
- ❌ A developer portal or signup page
- ❌ Exact authentication method (API key vs OAuth vs Basic Auth)
- ❌ Email address specifically for API access (I suggested `data.helpdesk@eea.europa.eu` based on common patterns)

## What You Should Actually Do

### Step 1: Check EEA Documentation Directly
1. Visit: https://www.eea.europa.eu/code/api
2. Look for:
   - "Registration" or "Sign Up" links
   - "API Access" or "Developer Portal" sections
   - Authentication documentation
   - Contact information for API support

### Step 2: Contact EEA Support
- **Primary**: Check the contact page: https://www.eea.europa.eu/en/about/contact-us
- **Look for**: API-specific support channels or helpdesk
- **Ask specifically**: "How do I obtain API credentials for the Air Quality Download Service?"

### Step 3: Alternative: Check if API is Actually Public
The API might:
- Require specific headers (User-Agent, Referer, etc.)
- Use different parameter names
- Have a different endpoint structure
- Be accessible through a different service

### Step 4: Check Spanish Air Quality Sources
Since you're monitoring Madrid specifically:
- Check if Spain has its own public API: https://www.miteco.gob.es/
- Look for "Calidad del Aire" or "Air Quality" APIs
- These might be more accessible than EEA's API

## What I've Prepared (Regardless of Actual Process)

I've updated the code to support multiple authentication methods:
- API Key (Bearer token)
- Basic Authentication
- Query parameter authentication

Once you find out the actual process, you can:
1. Add credentials to `.env.local`
2. The code will automatically use them
3. If the method differs, we can easily adjust the `getEEAAuthHeaders()` function

## Recommendation

**Before emailing**, please:
1. Browse https://www.eea.europa.eu/code/api thoroughly
2. Check for any "Register" or "API Access" buttons
3. Look for documentation about the Air Quality API specifically
4. Check if there's a developer portal or self-service registration

If you find specific documentation, I can update the guides accordingly!


# EEA Air Quality API - Real Implementation

## Overview

The application uses the **official EEA Air Quality Download Service API** which provides hourly up-to-date (E2a) station data. **No authentication is required** - only an email address in the request body.

## API Endpoint

**Base URL**: `https://eeadmz1-downloads-api-appservice.azurewebsites.net/`

**Swagger Documentation**: https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html

## Endpoints Used

### POST `/ParquetFile`
Downloads a ZIP file containing Parquet files (one per station).

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
- `pollutants`: Pollutant codes (e.g., `["O3"]`) or Concept URIs
- `dataset`: `1` = Up-To-Date (E2a), `2` = Verified (E1a), `3` = AirBase 2002–2012
- `dateTimeStart` / `dateTimeEnd`: UTC ISO 8601 timestamps
- `aggregationType`: `"hour"` | `"day"` | `"variable"`
- `email`: Contact email (required, but no authentication needed)

**Response**: ZIP file containing Parquet files

### Alternative Endpoints

- **POST `/ParquetFile/async`**: Returns a URL to poll for the ZIP when ready (recommended for large files)
- **POST `/ParquetFile/urls`**: Returns CSV with direct URLs to Parquet files (ignores dateTimeStart, dateTimeEnd, aggregationType)

## Data Format

### Parquet File Structure

Each Parquet file contains hourly O3 measurements for one station. Standard EEA field names:

- `AirQualityStationEoICode`: Station identifier
- `AirQualityStationName`: Station name
- `DatetimeBegin`: Start timestamp (UTC)
- `DatetimeEnd`: End timestamp (UTC)
- `AirPollutantCode`: Pollutant code (e.g., "O3")
- `Concentration`: Measured value
- `UnitOfMeasurement`: Unit (e.g., "µg/m³")

### Units

O₃ values arrive in **µg/m³** (micrograms per cubic meter).

## Configuration

Create a `.env.local` file with:

```bash
EEA_CONTACT_EMAIL=your-email@example.com
```

That's it! No API keys or authentication required.

## Usage Example

```bash
curl -X POST \
  https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile \
  -H "Content-Type: application/json" \
  -o madrid_o3.zip \
  -d '{
    "countries":["ES"],
    "cities":["Madrid"],
    "pollutants":["O3"],
    "dataset":1,
    "dateTimeStart":"2025-11-09T00:00:00Z",
    "dateTimeEnd":"2025-11-11T00:00:00Z",
    "aggregationType":"hour",
    "email":"your-email@example.com"
  }'
```

## Notes

- **No Authentication Required**: The API is publicly accessible
- **Email Required**: The `email` field is required in requests but is only used for contact purposes
- **Large Files**: If response >600MB, the service returns HTTP 206. Use `/async` endpoint for large requests
- **Scheduler Guidance**: Run at H+10 each hour to ensure the latest complete hour is closed upstream
- **Rate Limits**: No documented rate limits, but be respectful of the service

## References

- API Documentation: https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html
- EEA Air Quality Database: https://www.eea.europa.eu/data-and-maps/data/air-quality-database


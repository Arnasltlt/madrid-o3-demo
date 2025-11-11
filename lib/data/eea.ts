import axios from 'axios'
import * as yauzl from 'yauzl'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { StationData, HourlyData, EEAZone } from '@/types/station'
import { formatISOUTC, getLatestCompleteHour } from '@/lib/utils/timezone'

// EEA Air Quality Download Service API
// Docs: https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html
const EEA_DOWNLOAD_API = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile'
const EEA_DOWNLOAD_API_ASYNC = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile/async'
const EEA_DOWNLOAD_API_URLS = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile/urls'

// Legacy endpoints (kept for reference, not used)
const EEA_ZONES_API = 'https://discomap.eea.europa.eu/map/fme/AirQualityExport.htm'

/**
 * Fetch Madrid zone information from EEA Zones dataset
 * For now, returns a default Madrid zone identifier
 * (Geometry/spatial filtering can be added later if needed)
 */
export async function fetchMadridZone(): Promise<EEAZone | null> {
  // Return default Madrid zone identifier
  // The actual zone filtering can be done via the API's city parameter
  return {
    zone_id: 'ES0014A', // Common Madrid zone ID
    zone_name: 'Aglomeración de Madrid',
    country_code: 'ES',
  }
}

/**
 * Download and parse EEA E2a Up-To-Date hourly O3 data for Madrid
 * Uses the official EEA Air Quality Download Service API
 * 
 * @param hours Number of hours of data to fetch (default: 48)
 * @returns Array of hourly data grouped by UTC hour
 */
export async function fetchMadridO3Data(hours: number = 48): Promise<HourlyData[]> {
  try {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000)

    // Format dates as UTC ISO 8601 strings
    const dateTimeStart = startDate.toISOString()
    const dateTimeEnd = endDate.toISOString()

    // Request body for EEA Download Service API
    // dataset: 1 = Up-To-Date (E2a), 2 = Verified (E1a), 3 = AirBase 2002–2012
    const requestBody = {
      countries: ['ES'],
      cities: ['Madrid'],
      pollutants: ['O3'],
      dataset: 1, // E2a Up-To-Date
      dateTimeStart,
      dateTimeEnd,
      aggregationType: 'hour',
      email: process.env.EEA_CONTACT_EMAIL || 'monitor@madrid-o3.demo', // Required by API
    }

    // Use POST to /ParquetFile endpoint
    // For large files (>600MB), consider using /async endpoint instead
    const response = await axios.post(EEA_DOWNLOAD_API, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Madrid-O3-Monitor/1.0',
      },
      responseType: 'arraybuffer',
      timeout: 60000, // 60 seconds timeout for large downloads
    })

    // Parse ZIP file
    const zipBuffer = Buffer.from(response.data)
    const parquetData = await extractParquetFromZip(zipBuffer)
    
    // Parse Parquet files
    const hourlyData = await parseParquetData(parquetData)
    
    return hourlyData
  } catch (error) {
    console.error('Error fetching Madrid O3 data:', error)
    
    // Provide helpful error messages
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error(
          'EEA API request invalid. Check your request parameters. ' +
          `Error: ${error.response.data ? Buffer.from(error.response.data).toString() : 'Unknown'}`
        )
      }
      if (error.response?.status === 404) {
        throw new Error(
          'EEA API endpoint not found. The API URL may have changed. ' +
          'Check EEA documentation for updated endpoints.'
        )
      }
      if (error.response?.status === 500 || error.response?.status === 502) {
        throw new Error(
          'EEA API server error. The service may be temporarily unavailable. ' +
          'Try again later or use the async endpoint for large requests.'
        )
      }
      if (error.response?.status === 206) {
        // Partial content - file is >600MB, should use async endpoint
        throw new Error(
          'EEA API returned partial content (file too large). ' +
          'Consider using the async endpoint or reducing the time range.'
        )
      }
    }
    
    throw new Error(`Failed to fetch O3 data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract Parquet files from ZIP archive
 */
async function extractParquetFromZip(zipBuffer: Buffer): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const parquetFiles: Buffer[] = []
    
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      if (!zipfile) {
        reject(new Error('Failed to open ZIP file'))
        return
      }

      zipfile.readEntry()
      
      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('.parquet')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err)
              return
            }

            const chunks: Buffer[] = []
            readStream.on('data', (chunk) => chunks.push(chunk))
            readStream.on('end', () => {
              parquetFiles.push(Buffer.concat(chunks))
              zipfile.readEntry()
            })
            readStream.on('error', reject)
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        if (parquetFiles.length === 0) {
          reject(new Error('No Parquet files found in ZIP'))
        } else {
          resolve(parquetFiles)
        }
      })

      zipfile.on('error', reject)
    })
  })
}

/**
 * Parse Parquet data into hourly station data
 * EEA Parquet files use standard field names:
 * - AirQualityStationEoICode: Station identifier
 * - DatetimeBegin: Start timestamp (UTC)
 * - DatetimeEnd: End timestamp (UTC)
 * - AirPollutantCode: Pollutant code (e.g., "O3")
 * - Concentration: Measured value
 * - UnitOfMeasurement: Unit (e.g., "µg/m³")
 * 
 * Uses hyparquet (dynamic import) for DECIMAL type support
 */
async function parseParquetData(parquetBuffers: Buffer[]): Promise<HourlyData[]> {
  const allStations: Map<string, StationData[]> = new Map()
  
  // Check for force mock flag
  if (process.env.EEA_FORCE_MOCK === 'true') {
    throw new Error('EEA_FORCE_MOCK enabled - skipping real data parsing')
  }

  // Try hyparquet first (primary), fallback to parquet-wasm if needed
  let parseParquetBuffer: (buffer: Uint8Array) => Promise<any[]>
  
  // Try to load hyparquet (primary)
  try {
    const hyparquet = await import('hyparquet')
    parseParquetBuffer = async (uint8Array: Uint8Array) => {
      // hyparquet expects ArrayBuffer, convert from Uint8Array
      // Create a new ArrayBuffer to ensure type compatibility
      const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer
      return await hyparquet.parquetReadObjects({ file: arrayBuffer })
    }
    // hyparquet loaded successfully
  } catch (hyparquetError) {
    console.warn('hyparquet not available, trying parquet-wasm fallback:', hyparquetError)
    
    // Fallback to parquet-wasm + apache-arrow
    try {
      const parquetWasm = await import('parquet-wasm/node')
      const { tableFromIPC } = await import('apache-arrow')
      
      parseParquetBuffer = async (uint8Array: Uint8Array) => {
        const arrowWasmTable = (parquetWasm as any).readParquet(uint8Array)
        const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream())
        return arrowTable.toArray()
      }
      // parquet-wasm fallback loaded successfully
    } catch (wasmError) {
      console.error('Both hyparquet and parquet-wasm failed:', { hyparquetError, wasmError })
      throw new Error(`No Parquet parser available. Enable EEA_FORCE_MOCK or install hyparquet/parquet-wasm.`)
    }
  }

  let totalRecordsParsed = 0
  let sampleRecordLogged = false
  for (const buffer of parquetBuffers) {
    try {
      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(buffer)
      const records = await parseParquetBuffer(uint8Array)
      totalRecordsParsed += records.length
      
      
      for (const record of records) {
        // Extract station data - EEA Parquet files use "Samplingpoint" field
        // Format: "ES/SP_28006004_14_6" - extract station ID
        const samplingPoint = 
          record.Samplingpoint || 
          record.samplingpoint ||
          record.AirQualityStationEoICode || 
          record.airQualityStationEoICode ||
          record.stationId || 
          record.station_id || 
          record.StationId ||
          record.AirQualityStationLocalId ||
          record.airQualityStationLocalId

        // Extract station ID from Samplingpoint (format: "ES/SP_28006004_14_6")
        let stationId = samplingPoint
        if (samplingPoint && typeof samplingPoint === 'string') {
          // Extract the station code part (e.g., "SP_28006004_14_6" from "ES/SP_28006004_14_6")
          const parts = samplingPoint.split('/')
          stationId = parts.length > 1 ? parts[1] : parts[0]
        }

        const stationName = 
          record.AirQualityStationName ||
          record.airQualityStationName ||
          record.stationName || 
          record.station_name || 
          record.StationName || 
          stationId || 
          'Unknown Station'

        // Extract value - EEA Parquet uses "Value" field
        const value = parseFloat(
          record.Value || 
          record.value || 
          record.Concentration || 
          record.concentration || 
          0
        )

        // Extract timestamp - EEA Parquet uses "Start" field (start of hour)
        const timestamp = 
          record.Start || 
          record.start ||
          record.DatetimeBegin || 
          record.datetimeBegin ||
          record.Datetime ||
          record.datetime ||
          record.timestamp || 
          record.Timestamp ||
          record.dateTime

        // Extract unit - EEA Parquet uses "Unit" field (e.g., "ug.m-3")
        const unit = 
          record.Unit || 
          record.unit ||
          record.UnitOfMeasurement || 
          record.unitOfMeasurement ||
          'µg/m³'

        // Validate required fields
        if (!stationId || isNaN(value) || !timestamp) {
          continue
        }

        // Validate units (should be µg/m³ for O3)
        if (unit && !unit.toLowerCase().includes('µg/m³') && 
            !unit.toLowerCase().includes('ug/m3') &&
            !unit.toLowerCase().includes('microgram')) {
          console.warn(`Unexpected unit for O3: ${unit}, expected µg/m³`)
        }

        // Parse timestamp and group by hour (UTC)
        const timestampDate = new Date(timestamp)
        if (isNaN(timestampDate.getTime())) {
          console.warn(`Invalid timestamp: ${timestamp}`)
          continue
        }

        // Round to top of hour (UTC)
        const hourDate = new Date(timestampDate)
        hourDate.setMinutes(0, 0, 0)
        const hourKey = hourDate.toISOString()
        
        if (!allStations.has(hourKey)) {
          allStations.set(hourKey, [])
        }

        allStations.get(hourKey)!.push({
          station_id: String(stationId),
          station_name: String(stationName),
          value,
          timestamp_utc: timestampDate.toISOString(),
          unit: 'µg/m³', // Normalize to µg/m³
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Error parsing Parquet file:', errorMessage)
      // Continue with other files
    }
  }

  // Convert to HourlyData array, sorted by hour
  const hourlyData: HourlyData[] = Array.from(allStations.entries())
    .map(([hour_utc, stations]) => ({
      hour_utc,
      stations,
    }))
    .sort((a, b) => a.hour_utc.localeCompare(b.hour_utc))

  if (hourlyData.length > 0) {
    console.log(`Parsed ${hourlyData.length} hours of data from ${parquetBuffers.length} Parquet files (${totalRecordsParsed} total records), latest hour: ${hourlyData[hourlyData.length - 1].hour_utc}, ${hourlyData[hourlyData.length - 1].stations.length} stations`)
  } else {
    throw new Error(`Failed to parse any data from ${parquetBuffers.length} Parquet files (${totalRecordsParsed} total records parsed but no valid hourly data). Check field names and data format.`)
  }

  return hourlyData
}

/**
 * Get the latest complete hour's data
 */
export function getLatestCompleteHourData(hourlyData: HourlyData[]): HourlyData | null {
  if (hourlyData.length === 0) {
    return null
  }

  const latestCompleteHour = getLatestCompleteHour()
  const latestHourISO = formatISOUTC(latestCompleteHour)

  // Find exact match or closest previous hour
  let latestData: HourlyData | null = null
  for (let i = hourlyData.length - 1; i >= 0; i--) {
    const dataHour = hourlyData[i].hour_utc.slice(0, 13) + ':00:00.000Z'
    if (dataHour <= latestHourISO) {
      latestData = hourlyData[i]
      break
    }
  }

  return latestData || hourlyData[hourlyData.length - 1]
}

/**
 * Validate data coverage (ensure ≥2 stations)
 */
export function validateDataCoverage(hourlyData: HourlyData[]): boolean {
  if (hourlyData.length === 0) {
    return false
  }

  const latestData = getLatestCompleteHourData(hourlyData)
  if (!latestData || latestData.stations.length < 2) {
    return false
  }

  return true
}


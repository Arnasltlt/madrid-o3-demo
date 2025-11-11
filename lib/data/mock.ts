import type { HourlyData, StationData } from '@/types/station'
import { formatISOUTC, getLatestCompleteHour } from '@/lib/utils/timezone'

/**
 * Generate mock hourly data for testing
 * Simulates Madrid O3 monitoring stations
 */
export function generateMockHourlyData(hours: number = 48): HourlyData[] {
  const stations = [
    { id: 'ES0014A_001', name: 'Escuelas Aguirre' },
    { id: 'ES0014A_002', name: 'Villaverde' },
    { id: 'ES0014A_003', name: 'Casa de Campo' },
    { id: 'ES0014A_004', name: 'Barajas' },
  ]

  const hourlyData: HourlyData[] = []
  const now = new Date()
  
  // Generate data for the last N hours
  for (let i = hours - 1; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    hour.setMinutes(0, 0, 0)
    
    const stationData: StationData[] = stations.map(station => {
      // Simulate realistic O3 values (typically 50-200 µg/m³)
      // Occasionally exceed threshold for testing
      const baseValue = 120 + Math.random() * 60
      const value = Math.round(baseValue * 10) / 10
      
      return {
        station_id: station.id,
        station_name: station.name,
        value,
        timestamp_utc: formatISOUTC(hour),
        unit: 'µg/m³',
      }
    })
    
    hourlyData.push({
      hour_utc: formatISOUTC(hour),
      stations: stationData,
    })
  }
  
  return hourlyData
}

/**
 * Generate mock data with threshold exceedance for testing
 */
export function generateMockExceededData(): HourlyData[] {
  const data = generateMockHourlyData(48)
  
  // Set the latest hour to have an exceedance
  const latestHour = data[data.length - 1]
  if (latestHour && latestHour.stations.length > 0) {
    // Set first station to exceed threshold
    latestHour.stations[0].value = 185
    // Set previous hour to also exceed (for debounce)
    if (data.length > 1) {
      const prevHour = data[data.length - 2]
      if (prevHour && prevHour.stations.length > 0) {
        prevHour.stations[0].value = 182
      }
    }
  }
  
  return data
}

/**
 * Generate mock data to simulate recovery below the threshold
 */
export function generateMockRecoveryData(): HourlyData[] {
  const data = generateMockHourlyData(48)

  const latestHour = data[data.length - 1]
  const previousHour = data[data.length - 2]

  if (previousHour) {
    previousHour.stations = previousHour.stations.map((station) => ({
      ...station,
      value: 160,
    }))
  }

  if (latestHour) {
    latestHour.stations = latestHour.stations.map((station) => ({
      ...station,
      value: 150,
    }))
  }

  return data
}



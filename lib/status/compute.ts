import type { Status, StatusState, Station, MaxValue, TriggerStation, StatusResponse } from '@/types/status'
import type { HourlyData } from '@/types/station'
import { getLatestCompleteHourData } from '@/lib/data/eea'
import { formatDateTimeWithUTC, formatISOUTC } from '@/lib/utils/timezone'

const THRESHOLD = 180 // µg/m³
const STALE_DATA_THRESHOLD_MINUTES = 90
const DEBOUNCE_COUNT = 2

/**
 * Check if any station exceeds the threshold
 */
function checkThresholdExceeded(stations: Station[]): boolean {
  return stations.some(station => station.value >= THRESHOLD)
}

/**
 * Find the maximum 1-hour value and station
 */
function findMax1h(stations: Station[]): MaxValue | null {
  if (stations.length === 0) {
    return null
  }

  const maxStation = stations.reduce((max, station) => 
    station.value > max.value ? station : max
  )

  return {
    value: maxStation.value,
    station_id: maxStation.id,
    station_name: maxStation.name,
    timestamp_utc: maxStation.timestamp_utc,
  }
}

/**
 * Calculate maximum 8-hour rolling mean from hourly data
 */
function calculateMax8hMean(hourlyData: HourlyData[]): number {
  if (hourlyData.length === 0) {
    return 0
  }

  let max8hMean = 0

  // Calculate 8-hour rolling means
  for (let i = 7; i < hourlyData.length; i++) {
    const last8Hours = hourlyData.slice(i - 7, i + 1)
    
    // Get all station values for these 8 hours
    const stationValues = new Map<string, number[]>()
    
    last8Hours.forEach(hour => {
      hour.stations.forEach(station => {
        if (!stationValues.has(station.station_id)) {
          stationValues.set(station.station_id, [])
        }
        stationValues.get(station.station_id)!.push(station.value)
      })
    })

    // Calculate mean for each station, then find max
    stationValues.forEach((values, stationId) => {
      if (values.length === 8) {
        const mean = values.reduce((sum, val) => sum + val, 0) / 8
        max8hMean = Math.max(max8hMean, mean)
      }
    })
  }

  return Math.round(max8hMean * 100) / 100
}

/**
 * Calculate data age in minutes
 */
function calculateDataAge(latestHourUTC: string): number {
  const latestHour = new Date(latestHourUTC)
  const now = new Date()
  const diffMs = now.getTime() - latestHour.getTime()
  return Math.floor(diffMs / (1000 * 60))
}

/**
 * Compute status from hourly data and current state
 * @param bypassDebounce - If true, immediately flip status without waiting for consecutive counts (for demo mode)
 */
export function computeStatus(
  hourlyData: HourlyData[],
  currentState: StatusState | null,
  bypassDebounce: boolean = false
): StatusState {
  const latestData = getLatestCompleteHourData(hourlyData)
  
  if (!latestData || latestData.stations.length === 0) {
    // No data - maintain current state or default to COMPLIANT
    return currentState || {
      current_status: 'COMPLIANT',
      previous_status: null,
      last_check_timestamp: formatISOUTC(new Date()),
      episode_start: null,
      consecutive_exceeded: 0,
      consecutive_compliant: 0,
      data_age_minutes: 999,
    }
  }

  // Convert to Station format
  const stations: Station[] = latestData.stations.map(s => ({
    id: s.station_id,
    name: s.station_name,
    value: s.value,
    timestamp_utc: s.timestamp_utc,
  }))

  const exceeded = checkThresholdExceeded(stations)
  const dataAgeMinutes = calculateDataAge(latestData.hour_utc)
  
  // Check station coverage
  const coverageReduced = stations.length < 2
  
  // Freeze state if data is stale or coverage is reduced (unless bypassed for demo)
  if (!bypassDebounce && (dataAgeMinutes > STALE_DATA_THRESHOLD_MINUTES || coverageReduced) && currentState) {
    return {
      ...currentState,
      data_age_minutes: dataAgeMinutes,
      last_check_timestamp: formatISOUTC(new Date()),
    }
  }
  
  // For demo mode, cap data age to appear fresh
  const effectiveDataAge = bypassDebounce ? Math.min(dataAgeMinutes, 30) : dataAgeMinutes

  // Initialize state if null
  const state: StatusState = currentState || {
    current_status: 'COMPLIANT',
    previous_status: null,
    last_check_timestamp: formatISOUTC(new Date()),
    episode_start: null,
    consecutive_exceeded: 0,
    consecutive_compliant: 0,
    data_age_minutes: effectiveDataAge,
  }

  // Update consecutive counts
  let newConsecutiveExceeded = exceeded ? state.consecutive_exceeded + 1 : 0
  let newConsecutiveCompliant = exceeded ? 0 : state.consecutive_compliant + 1

  // Determine new status with debounce (unless bypassed for demo)
  let newStatus: Status = state.current_status
  let episodeStart = state.episode_start
  let trigger: TriggerStation | undefined = state.trigger

  if (exceeded) {
    // Need 2 consecutive exceeds to flip to INFO_EXCEEDED (unless bypassed)
    if (bypassDebounce || newConsecutiveExceeded >= DEBOUNCE_COUNT) {
      if (bypassDebounce) {
        // For demo mode, set consecutive count to satisfy debounce
        newConsecutiveExceeded = DEBOUNCE_COUNT
      }
      if (state.current_status !== 'INFO_EXCEEDED') {
        newStatus = 'INFO_EXCEEDED'
        episodeStart = latestData.hour_utc
        // Find the station with highest value >= 180 that triggered
        const exceededStations = stations.filter(s => s.value >= THRESHOLD)
        if (exceededStations.length > 0) {
          const triggerStation = exceededStations.reduce((max, s) => 
            s.value > max.value ? s : max
          )
          trigger = {
            id: triggerStation.id,
            name: triggerStation.name,
            value: triggerStation.value,
            ts_utc: latestData.hour_utc,
          }
        }
      }
    }
  } else {
    // Need 2 consecutive compliant hours to recover (unless bypassed)
    if (bypassDebounce || newConsecutiveCompliant >= DEBOUNCE_COUNT) {
      if (bypassDebounce) {
        // For demo mode, set consecutive count to satisfy debounce
        newConsecutiveCompliant = DEBOUNCE_COUNT
      }
      if (state.current_status !== 'COMPLIANT') {
        newStatus = 'COMPLIANT'
        episodeStart = null
        trigger = undefined
      }
    }
  }

  return {
    current_status: newStatus,
    previous_status: state.current_status,
    last_check_timestamp: formatISOUTC(new Date()),
    episode_start: episodeStart,
    consecutive_exceeded: newConsecutiveExceeded,
    consecutive_compliant: newConsecutiveCompliant,
    data_age_minutes: effectiveDataAge,
    trigger,
  }
}

/**
 * Build status response with all computed fields
 */
export function buildStatusResponse(
  state: StatusState,
  hourlyData: HourlyData[]
): StatusResponse {
  const latestData = getLatestCompleteHourData(hourlyData)
  
  if (!latestData || latestData.stations.length === 0) {
    throw new Error('No data available')
  }

  const stations: Station[] = latestData.stations.map(s => ({
    id: s.station_id,
    name: s.station_name,
    value: s.value,
    timestamp_utc: s.timestamp_utc,
  }))

  const max1h = findMax1h(stations)
  if (!max1h) {
    throw new Error('No valid station data')
  }

  const max8h = calculateMax8hMean(hourlyData)

  // Calculate episode duration
  let durationHours: number | null = null
  if (state.episode_start) {
    const start = new Date(state.episode_start)
    const end = new Date(latestData.hour_utc)
    durationHours = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60))
  }

  // Check coverage
  const coverageReduced = stations.length < 2

  // Build why string if INFO_EXCEEDED
  let why: string | undefined
  if (state.current_status === 'INFO_EXCEEDED' && state.trigger) {
    const triggerTime = formatDateTimeWithUTC(state.trigger.ts_utc || latestData.hour_utc)
    why = `${state.trigger.name}: ${state.trigger.value.toFixed(1)} µg/m³ a las ${triggerTime.local} (${triggerTime.utc})`
  }

  const dataAgeMinutes = calculateDataAge(latestData.hour_utc)

  return {
    version: '1',
    zone_code: 'ES0014A',
    status: state.current_status,
    data_age_minutes: dataAgeMinutes,
    as_of_utc: latestData.hour_utc,
    max_1h: max1h,
    max_8h: max8h,
    episode_start: state.episode_start,
    duration_hours: durationHours,
    stations,
    notice_pdf_url: '/madrid/latest.pdf',
    why: why ?? null,
    trigger_station: state.trigger ?? null,
    coverage_reduced: coverageReduced,
  }
}


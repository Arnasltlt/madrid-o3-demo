import type { StatusState, ChangeLogEntry, StatusResponse } from '@/types/status'
import { formatISOUTC } from '@/lib/utils/timezone'

// In-memory state storage (for Vercel serverless)
// In production, consider using Vercel KV or Postgres for persistence
let currentState: StatusState | null = null
let changeLog: ChangeLogEntry[] = []
let lastHourlyData: any[] = []
let episodeSnapshots: { id: string; snapshot: StatusResponse }[] = []

const MAX_CHANGELOG_ENTRIES = 10
const MAX_EPISODE_SNAPSHOTS = 60

function createEpisodeId(snapshot: StatusResponse): string {
  return snapshot.as_of_utc.replace(/[:.]/g, '-')
}

/**
 * Get current status state
 */
export function getCurrentState(): StatusState | null {
  return currentState
}

/**
 * Update status state and track changes
 */
export function updateState(
  newState: StatusState, 
  triggerStation: string | null = null,
  hourUtc?: string,
  dataAgeMinutes?: number
): void {
  const oldStatus = currentState?.current_status || null
  
  // Track state changes
  if (oldStatus && oldStatus !== newState.current_status) {
    const changeEntry: ChangeLogEntry = {
      timestamp: formatISOUTC(new Date()),
      from_status: oldStatus,
      to_status: newState.current_status,
      trigger_station: triggerStation,
      station_id: newState.trigger?.id,
      station_name: newState.trigger?.name,
      value: newState.trigger?.value,
      hour_utc: hourUtc || newState.trigger?.ts_utc,
      data_age_minutes_at_flip: dataAgeMinutes ?? newState.data_age_minutes,
    }
    
    changeLog.unshift(changeEntry)
    
    // Keep only recent entries
    if (changeLog.length > MAX_CHANGELOG_ENTRIES) {
      changeLog = changeLog.slice(0, MAX_CHANGELOG_ENTRIES)
    }
  }

  currentState = newState
}

/**
 * Get change log
 */
export function getChangeLog(): ChangeLogEntry[] {
  return changeLog
}

/**
 * Store episode snapshot when INFO_EXCEEDED is triggered
 */
export function addEpisodeSnapshot(snapshot: StatusResponse): void {
  if (snapshot.status !== 'INFO_EXCEEDED') {
    return
  }

  const id = createEpisodeId(snapshot)
  if (episodeSnapshots.some((episode) => episode.id === id)) {
    return
  }

  episodeSnapshots.unshift({ id, snapshot })
  if (episodeSnapshots.length > MAX_EPISODE_SNAPSHOTS) {
    episodeSnapshots = episodeSnapshots.slice(0, MAX_EPISODE_SNAPSHOTS)
  }
}

/**
 * Retrieve stored episode snapshots
 */
export function getEpisodeSnapshots(): { id: string; snapshot: StatusResponse }[] {
  return episodeSnapshots
}

/**
 * Lookup a snapshot by identifier
 */
export function findEpisodeSnapshot(id: string): StatusResponse | undefined {
  return episodeSnapshots.find((episode) => episode.id === id)?.snapshot
}

/**
 * Store hourly data snapshot
 */
export function storeHourlyData(data: any[]): void {
  lastHourlyData = data
}

/**
 * Get stored hourly data
 */
export function getHourlyData(): any[] {
  return lastHourlyData
}

/**
 * Initialize state (for first run)
 */
export function initializeState(): void {
  if (!currentState) {
    currentState = {
      current_status: 'COMPLIANT',
      previous_status: null,
      last_check_timestamp: formatISOUTC(new Date()),
      episode_start: null,
      consecutive_exceeded: 0,
      consecutive_compliant: 0,
      data_age_minutes: 0,
    }
  }
}


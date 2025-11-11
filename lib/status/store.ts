import type { StatusState, ChangeLogEntry } from '@/types/status'
import { formatISOUTC } from '@/lib/utils/timezone'

// In-memory state storage (for Vercel serverless)
// In production, consider using Vercel KV or Postgres for persistence
let currentState: StatusState | null = null
let changeLog: ChangeLogEntry[] = []
let lastHourlyData: any[] = []

const MAX_CHANGELOG_ENTRIES = 100

/**
 * Get current status state
 */
export function getCurrentState(): StatusState | null {
  return currentState
}

/**
 * Update status state and track changes
 */
export function updateState(newState: StatusState, triggerStation: string | null = null): void {
  const oldStatus = currentState?.current_status || null
  
  // Track state changes
  if (oldStatus && oldStatus !== newState.current_status) {
    const changeEntry: ChangeLogEntry = {
      timestamp: formatISOUTC(new Date()),
      from_status: oldStatus,
      to_status: newState.current_status,
      trigger_station: triggerStation,
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


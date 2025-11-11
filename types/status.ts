export type Status = 'INFO_EXCEEDED' | 'COMPLIANT'

export interface Station {
  id: string
  name: string
  value: number
  timestamp: string
}

export interface MaxValue {
  value: number
  station: string
  timestamp: string
}

export interface StatusResponse {
  status: Status
  data_age_minutes: number
  latest_hour_utc: string
  max_1h: MaxValue
  max_8h: number
  episode_start: string | null
  duration_hours: number | null
  stations: Station[]
  pdf_url: string
  why?: string
  trigger_station?: TriggerStation
  coverage_reduced?: boolean
}

export interface ChangeLogEntry {
  timestamp: string
  from_status: Status
  to_status: Status
  trigger_station: string | null
  station_id?: string
  station_name?: string
  value?: number
  hour_utc?: string
  data_age_minutes_at_flip?: number
}

export interface TriggerStation {
  id: string
  name: string
  value: number
  ts_utc: string
}

export interface StatusState {
  current_status: Status
  previous_status: Status | null
  last_check_timestamp: string
  episode_start: string | null
  consecutive_exceeded: number
  consecutive_compliant: number
  data_age_minutes: number
  trigger?: TriggerStation
}


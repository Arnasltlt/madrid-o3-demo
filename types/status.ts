export type Status = 'INFO_EXCEEDED' | 'COMPLIANT'

export interface Station {
  id: string
  name: string
  value: number
  timestamp_utc: string
}

export interface MaxValue {
  value: number
  station_id: string
  station_name: string
  timestamp_utc: string
}

export interface TriggerStation {
  id: string
  name: string
  value: number
  ts_utc: string
}

export interface StatusResponse {
  version: string
  zone_code: string
  status: Status
  data_age_minutes: number
  as_of_utc: string
  max_1h: MaxValue
  max_8h: number
  episode_start: string | null
  duration_hours: number | null
  stations: Station[]
  notice_pdf_url: string
  why: string | null
  trigger_station: TriggerStation | null
  coverage_reduced: boolean
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

export interface StatusJsonContract {
  version: string
  zone_code: string
  as_of_utc: string
  status: Status
  why: string | null
  o3_max_1h_ugm3: number | null
  o3_max_8h_ugm3: number | null
  trigger_station: {
    id: string
    name: string
    ts_utc: string
  } | null
  data_age_minutes: number
  stations: {
    id: string
    name: string
    value: number
    timestamp_utc: string
  }[]
  notice_pdf_url: string | null
}


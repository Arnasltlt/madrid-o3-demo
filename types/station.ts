export interface StationData {
  station_id: string
  station_name: string
  value: number
  timestamp_utc: string
  unit: string
}

export interface HourlyData {
  hour_utc: string
  stations: StationData[]
}

export interface EEAZone {
  zone_id: string
  zone_name: string
  country_code: string
  geometry?: any
}


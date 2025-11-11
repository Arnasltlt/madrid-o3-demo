import type { StatusJsonContract, StatusResponse } from '@/types/status'

export function toStatusJsonContract(status: StatusResponse): StatusJsonContract {
  return {
    version: status.version,
    zone_code: status.zone_code,
    as_of_utc: status.as_of_utc,
    status: status.status,
    why: status.why,
    o3_max_1h_ugm3: status.max_1h?.value ?? null,
    o3_max_8h_ugm3: status.max_8h ?? null,
    trigger_station: status.trigger_station
      ? {
          id: status.trigger_station.id,
          name: status.trigger_station.name,
          ts_utc: status.trigger_station.ts_utc,
        }
      : null,
    data_age_minutes: status.data_age_minutes,
    stations: status.stations.map((station) => ({
      id: station.id,
      name: station.name,
      value: station.value,
      timestamp_utc: station.timestamp_utc,
    })),
    notice_pdf_url: status.notice_pdf_url || null,
  }
}



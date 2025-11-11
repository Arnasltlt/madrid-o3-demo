import type { StatusResponse } from '@/types/status'
import { formatDateTimeWithUTC } from './timezone'

export interface NoticeContent {
  area: string
  type: string
  episode_start_local?: string
  episode_start_utc?: string
  duration_hours: number | null
  max_1h_value: number
  max_1h_station: string
  max_1h_local: string
  max_1h_utc: string
  max_8h: number
  forecast: string
}

/**
 * Build normalized notice content from status response
 */
export function buildNoticeContent(status: StatusResponse): NoticeContent {
  const episodeStart = status.episode_start 
    ? formatDateTimeWithUTC(status.episode_start)
    : null

  const max1hTime = formatDateTimeWithUTC(status.max_1h.timestamp)

  return {
    area: 'Aglomeración de Madrid',
    type: 'Umbral de información O₃ (180 µg/m³, 1 h)',
    episode_start_local: episodeStart?.local,
    episode_start_utc: episodeStart?.utc,
    duration_hours: status.duration_hours,
    max_1h_value: status.max_1h.value,
    max_1h_station: status.max_1h.station,
    max_1h_local: max1hTime.local,
    max_1h_utc: max1hTime.utc,
    max_8h: status.max_8h,
    forecast: 'Se recomienda consultar las fuentes oficiales para información actualizada.',
  }
}


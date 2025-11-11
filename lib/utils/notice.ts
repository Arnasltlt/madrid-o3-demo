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
function safeFormat(date: string | null | undefined): { local: string; utc: string } | null {
  if (!date) {
    return null
  }

  try {
    return formatDateTimeWithUTC(date)
  } catch (error) {
    console.warn('Unable to format datetime for notice content:', date, error)
    return null
  }
}

export function buildNoticeContent(status: StatusResponse): NoticeContent {
  const episodeStart = safeFormat(status.episode_start ?? null)

  const maxTimestamp = status.max_1h?.timestamp_utc ?? status.as_of_utc
  const maxTime = safeFormat(maxTimestamp) ?? { local: 'Sin datos', utc: 'Sin datos' }
  const maxStationName = status.max_1h?.station_name ?? status.trigger_station?.name ?? 'Sin datos'
  const maxValue = typeof status.max_1h?.value === 'number' && Number.isFinite(status.max_1h.value) ? status.max_1h.value : 0
  const max8h = typeof status.max_8h === 'number' && Number.isFinite(status.max_8h) ? status.max_8h : 0
  const duration = typeof status.duration_hours === 'number' && Number.isFinite(status.duration_hours)
    ? status.duration_hours
    : null

  return {
    area: 'Aglomeración de Madrid',
    type: 'Umbral de información O₃ (180 µg/m³, 1 h)',
    episode_start_local: episodeStart?.local ?? undefined,
    episode_start_utc: episodeStart?.utc ?? undefined,
    duration_hours: duration,
    max_1h_value: maxValue,
    max_1h_station: maxStationName,
    max_1h_local: maxTime.local,
    max_1h_utc: maxTime.utc,
    max_8h: max8h,
    forecast: 'Se recomienda consultar las fuentes oficiales para información actualizada.',
  }
}


import { format, formatInTimeZone } from 'date-fns-tz'

const MADRID_TIMEZONE = 'Europe/Madrid'

export function toMadridTime(utcDate: Date | string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd HH:mm', {
    timeZone: MADRID_TIMEZONE,
  })
}

export function formatMadridDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, MADRID_TIMEZONE, 'dd/MM/yyyy HH:mm', {
    timeZone: MADRID_TIMEZONE,
  })
}

export function getLatestCompleteHour(): Date {
  const now = new Date()
  // Round down to the latest complete hour
  now.setMinutes(0, 0, 0)
  // Subtract 1 hour to get the latest complete hour
  now.setHours(now.getHours() - 1)
  return now
}

export function formatISOUTC(date: Date): string {
  return date.toISOString()
}

/**
 * Format timestamp with Madrid local time and UTC in smaller text
 */
export function formatDateTimeWithUTC(date: Date | string): { local: string; utc: string } {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const local = formatMadridDateTime(dateObj)
  const utc = formatInTimeZone(dateObj, 'UTC', 'yyyy-MM-dd HH:mm UTC')
  return { local, utc }
}


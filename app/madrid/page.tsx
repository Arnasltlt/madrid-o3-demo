'use client'

import React, { useEffect, useMemo, useRef, useState, type SVGProps } from 'react'
import Link from 'next/link'
import type { ChangeLogEntry, Status, StatusJsonContract, StatusResponse, Station, TriggerStation } from '@/types/status'
import { formatDateTimeWithUTC } from '@/lib/utils/timezone'
import { buildNoticeContent } from '@/lib/utils/notice'

const STATUS_ENDPOINT = '/api/madrid/status'
const STATUS_CONTRACT_ENDPOINT = '/madrid/status.json'
const CHANGELOG_ENDPOINT = '/api/madrid/changelog'
const INGEST_ENDPOINT = '/api/madrid/ingest'
const DEFAULT_PDF_URL = '/madrid/latest.pdf'
const STALE_THRESHOLD_MINUTES = 90
const ERROR_MESSAGE = 'No se pudo actualizar. Reintentando en 5 min.'

type IconProps = SVGProps<SVGSVGElement>

function CheckCircleIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx={12} cy={12} r={10} />
    </svg>
  )
}

function AlertTriangleIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1={12} y1={9} x2={12} y2={13} />
      <line x1={12} y1={17} x2={12.01} y2={17} />
    </svg>
  )
}

function ClockIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx={12} cy={12} r={9} />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

function FilePdfIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15h1.5a1.5 1.5 0 000-3H9v4" />
      <path d="M13 11h1a1 1 0 011 1v3h-2" />
      <path d="M17 15h2" />
    </svg>
  )
}

function CopyIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function InfoIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12.01} y2={8} />
    </svg>
  )
}

const STATUS_LABELS: Record<Status, string> = {
  INFO_EXCEEDED: 'UMBRAL DE INFORMACIÓN SUPERADO',
  COMPLIANT: 'EN CUMPLIMIENTO',
}

const THRESHOLD_UGM3 = 180

interface FormattedDateTime {
  local: string
  utc: string
}

interface EpisodeSummary {
  id: string
  status: string
  as_of_utc: string
  as_of_local: string
  trigger_station: {
    id: string
    name: string
    ts_utc: string
  } | null
  o3_max_1h_ugm3: number | null
  pdf_url: string
}

function safeFormatDateTime(value?: string | null): FormattedDateTime | null {
  if (!value) {
    return null
  }
  try {
    return formatDateTimeWithUTC(value)
  } catch (error) {
    console.warn('Failed to format datetime:', value, error)
    return null
  }
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const coerced = Number(value)
  return Number.isFinite(coerced) ? coerced : fallback
}

function sanitizeStations(stations: StatusJsonContract['stations'] | unknown, fallbackTimestamp: string): Station[] {
  if (!Array.isArray(stations)) {
    return []
  }

  return stations
    .map((item) => {
      const id = typeof item?.id === 'string' ? item.id : typeof item?.id === 'number' ? String(item.id) : ''
      const name = typeof item?.name === 'string' ? item.name : 'Sin nombre'
      const value = normalizeNumber(item?.value)
      const timestampUtc =
        typeof item?.timestamp_utc === 'string'
          ? item.timestamp_utc
          : typeof item?.timestamp === 'string'
          ? item.timestamp
          : fallbackTimestamp

      if (!id) {
        return null
      }

      return {
        id,
        name,
        value,
        timestamp_utc: timestampUtc,
      }
    })
    .filter((station): station is Station => Boolean(station))
}

function deriveStatusFromContract(contract: StatusJsonContract): StatusResponse {
  const asOfUtc =
    typeof contract.as_of_utc === 'string' && contract.as_of_utc.length > 0
      ? contract.as_of_utc
      : new Date().toISOString()

  const stations = sanitizeStations(contract.stations, asOfUtc)
  const activeStations = stations.filter((station) => Number.isFinite(station.value))

  const fallbackStation: Station = {
    id: 'sin-datos',
    name: 'Sin datos',
    value: 0,
    timestamp_utc: asOfUtc,
  }

  const fallbackStations = activeStations.length > 0 ? activeStations : stations.length > 0 ? stations : [fallbackStation]

  const maxStation = fallbackStations.reduce<Station>((acc, station) => {
    if (!acc || station.value > acc.value) {
      return station
    }
    return acc
  }, fallbackStations[0])

  const maxValue = typeof contract.o3_max_1h_ugm3 === 'number' ? contract.o3_max_1h_ugm3 : maxStation.value
  const triggerInput = contract.trigger_station
  const triggerStation: TriggerStation | null = triggerInput
    ? {
        id: triggerInput.id,
        name: triggerInput.name,
        value:
          activeStations.find((station) => station.id === triggerInput.id)?.value ??
          maxValue ??
          maxStation.value,
        ts_utc: triggerInput.ts_utc,
      }
    : null

  const coverageReduced = activeStations.length < 2

  return {
    version: contract.version ?? '1',
    zone_code: contract.zone_code ?? 'ES0014A',
    status: contract.status,
    data_age_minutes: normalizeNumber(contract.data_age_minutes, 999),
    as_of_utc: asOfUtc,
    max_1h: {
      value: maxValue,
      station_id: maxStation.id,
      station_name: maxStation.name,
      timestamp_utc: maxStation.timestamp_utc,
    },
    max_8h: normalizeNumber(contract.o3_max_8h_ugm3),
    episode_start: null,
    duration_hours: null,
    stations: stations.length > 0 ? stations : [fallbackStation],
    notice_pdf_url: contract.notice_pdf_url ?? DEFAULT_PDF_URL,
    why: typeof contract.why === 'string' ? contract.why : null,
    trigger_station: triggerStation,
    pending_status: null,
    coverage_reduced: coverageReduced,
  }
}

function findTriggerValue(status: StatusResponse): number | null {
  if (!status.trigger_station) {
    return null
  }
  const matchedStation = status.stations.find((station) => station.id === status.trigger_station?.id)
  if (matchedStation) {
    return matchedStation.value
  }
  if (typeof status.trigger_station.value === 'number') {
    return status.trigger_station.value
  }
  if (typeof status.max_1h?.value === 'number') {
    return status.max_1h.value
  }
  return null
}

function formatConcentration(value: number | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(1)
  }
  return 'N/D'
}

function getPdfUrl(status: StatusResponse | null, contract: StatusJsonContract | null): string {
  if (status && typeof status.notice_pdf_url === 'string' && status.notice_pdf_url.length > 0) {
    return status.notice_pdf_url
  }
  if (contract && typeof contract.notice_pdf_url === 'string' && contract.notice_pdf_url.length > 0) {
    return contract.notice_pdf_url
  }
  return DEFAULT_PDF_URL
}

export default function MadridPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusContract, setStatusContract] = useState<StatusJsonContract | null>(null)
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([])
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const previousStatusRef = useRef<Status | null>(null)
  const [showRecoveryToast, setShowRecoveryToast] = useState(false)

  useEffect(() => {
    void fetchStatus()
    void fetchChangelog()
    void fetchEpisodes()
  }, [])

  const loadDemo = async (mode: 'exceeded' | 'compliant') => {
    setLoading(true)
    try {
      const response = await fetch(`${INGEST_ENDPOINT}?demo=${mode}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`No se pudo cargar demo: ${mode}`)
      }
      // Reload all data after demo load
      await fetchStatus()
      await fetchChangelog()
      await fetchEpisodes()
    } catch (err) {
      console.error('Failed to load demo:', err)
      setError(ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatus = async () => {
    setLoading(true)
    try {
      let response = await fetch(STATUS_ENDPOINT, { cache: 'no-store' })

      if (response.status === 503) {
        const ingestResponse = await fetch(INGEST_ENDPOINT, { cache: 'no-store' })
        if (!ingestResponse.ok) {
          throw new Error('No se pudo iniciar la ingesta de datos')
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
        response = await fetch(STATUS_ENDPOINT, { cache: 'no-store' })
      }

      if (!response.ok) {
        throw new Error('No se pudo obtener el estado')
      }

      const data = (await response.json()) as StatusResponse
      setStatus(data)
      setError(null)
      setStatusContract(null)
    } catch (err) {
      console.error('Failed to fetch status:', err)
      setError(ERROR_MESSAGE)
      await fetchStatusContract()
    } finally {
      setLoading(false)
    }
  }

  const fetchStatusContract = async () => {
    try {
      const response = await fetch(STATUS_CONTRACT_ENDPOINT, { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as StatusJsonContract
      setStatusContract(data)
    } catch (err) {
      console.warn('Failed to fetch status contract:', err)
    }
  }

  const fetchChangelog = async () => {
    try {
      const response = await fetch(CHANGELOG_ENDPOINT, { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as ChangeLogEntry[]
      setChangelog(data)
    } catch (err) {
      console.warn('Failed to fetch changelog:', err)
    }
  }

  const fetchEpisodes = async () => {
    try {
      const response = await fetch('/api/madrid/episodes', { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as EpisodeSummary[]
      setEpisodes(data)
    } catch (err) {
      console.warn('Failed to fetch episodes:', err)
    }
  }

  const statusForView = useMemo<StatusResponse | null>(() => {
    if (status) {
      return status
    }
    if (statusContract) {
      return deriveStatusFromContract(statusContract)
    }
    return null
  }, [status, statusContract])

  const pdfUrl = getPdfUrl(statusForView, statusContract)
  const isExceeded = statusForView?.status === 'INFO_EXCEEDED'
  const isStale = (statusForView?.data_age_minutes ?? 0) > STALE_THRESHOLD_MINUTES
  const coverageReduced = statusForView?.coverage_reduced ?? (statusForView ? statusForView.stations.filter((station) => Number.isFinite(station.value)).length < 2 : false)

  const max1hValue = statusForView?.max_1h?.value
  const max1hStation = statusForView?.max_1h?.station_name ?? statusForView?.trigger_station?.name ?? 'Sin datos'
  const max1hTime = safeFormatDateTime(statusForView?.max_1h?.timestamp_utc ?? statusForView?.as_of_utc ?? null)
  const episodeStartTime = safeFormatDateTime(statusForView?.episode_start ?? null)
  const noticeContent = statusForView ? buildNoticeContent(statusForView) : null
  const asOfTime = safeFormatDateTime(statusForView?.as_of_utc ?? null)
  const asOfLocal = asOfTime?.local ?? 'Sin datos'
  const asOfUtc = asOfTime?.utc ?? 'N/D'
  const dataAgeValue = statusForView?.data_age_minutes
  const dataAgeIsFinite = typeof dataAgeValue === 'number' && Number.isFinite(dataAgeValue)
  const dataAgeLabel = dataAgeIsFinite ? `${dataAgeValue} min` : 'Sin datos'
  const statusLabel = statusForView ? STATUS_LABELS[statusForView.status] : 'Sin datos'
  const statusBadgeClass = isExceeded ? 'gov-badge gov-badge--warn' : 'gov-badge gov-badge--ok'
  const statusIcon = isExceeded ? <AlertTriangleIcon className="gov-icon" /> : <CheckCircleIcon className="gov-icon" />
  const triggerStationName = statusForView?.trigger_station?.name ?? statusForView?.max_1h?.station_name ?? 'Sin datos'
  const triggerValue = statusForView ? findTriggerValue(statusForView) ?? statusForView.max_1h?.value ?? null : null
  const triggerDisplayValue = formatConcentration(triggerValue)
  const triggerTime = safeFormatDateTime(
    statusForView?.trigger_station?.ts_utc ?? statusForView?.max_1h?.timestamp_utc ?? statusForView?.as_of_utc ?? null
  )
  const triggerTimeLocal = triggerTime?.local ?? 'Sin datos'
  const triggerTimeUtc = triggerTime?.utc ?? 'N/D'
  const comparisonSymbol = isExceeded ? '≥' : '<'
  const whySentence = statusForView
    ? `O₃ ${comparisonSymbol} ${THRESHOLD_UGM3} µg/m³ en ${triggerStationName}, ${triggerDisplayValue} µg/m³ a las ${triggerTimeLocal} (${triggerTimeUtc}).`
    : 'Sin datos disponibles para explicar el estado actual.'
  const noticeDuration =
    noticeContent && noticeContent.duration_hours !== null ? `${noticeContent.duration_hours} horas` : 'En curso'
  const noticeStartLocal = noticeContent?.episode_start_local
  const noticeStartUtc = noticeContent?.episode_start_utc
  const max1hLocal = max1hTime?.local ?? 'Sin datos'
  const max1hUtc = max1hTime?.utc ?? 'N/D'
  const max8hLabel = formatConcentration(statusForView?.max_8h)
  const triggerStationId = statusForView?.trigger_station?.id ?? statusForView?.max_1h?.station_id ?? null
  const statusJsonHref = STATUS_CONTRACT_ENDPOINT
  const pendingStatus = statusForView?.pending_status ?? null
  const showDebounceChip = Boolean(pendingStatus)
  const pendingChipAria =
    pendingStatus === 'INFO_EXCEEDED'
      ? 'Confirmando cambio a umbral de información'
      : pendingStatus === 'COMPLIANT'
      ? 'Confirmando retorno a cumplimiento'
      : undefined
  const changeLogEntries = changelog.slice(0, 10)
  const hasStations = (statusForView?.stations?.length ?? 0) > 0

  const episodesByTrigger = useMemo(() => {
    return episodes.reduce<Record<string, EpisodeSummary>>((acc, episode) => {
      if (episode.trigger_station?.ts_utc) {
        acc[episode.trigger_station.ts_utc] = episode
      }
      acc[episode.as_of_utc] = episode
      return acc
    }, {})
  }, [episodes])

  useEffect(() => {
    if (!statusForView) {
      previousStatusRef.current = null
      setShowRecoveryToast(false)
      return
    }

    if (statusForView.status !== 'COMPLIANT') {
      setShowRecoveryToast(false)
    }

    let timeoutId: number | undefined
    if (previousStatusRef.current === 'INFO_EXCEEDED' && statusForView.status === 'COMPLIANT') {
      setShowRecoveryToast(true)
      timeoutId = window.setTimeout(() => {
        setShowRecoveryToast(false)
      }, 4000)
    }

    previousStatusRef.current = statusForView.status

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [statusForView])

  const copyNoticeHTML = () => {
    if (!statusForView) {
      return
    }

    try {
      const notice = buildNoticeContent(statusForView)
      const inicioHtml = notice.episode_start_local
        ? `<p><strong>Inicio y duración:</strong> ${notice.episode_start_local} (${notice.episode_start_utc}) • ${
            notice.duration_hours !== null ? `${notice.duration_hours} horas` : 'En curso'
          }</p>`
        : ''

      const noticeHTML = `
<div>
  <h2>Umbral de Información O₃</h2>
  <p><strong>Área:</strong> ${notice.area}</p>
  <p><strong>Tipo:</strong> ${notice.type}</p>
  ${inicioHtml}
  <p><strong>Valor máximo 1 h:</strong> ${notice.max_1h_value.toFixed(1)} µg/m³ · ${notice.max_1h_station} · ${notice.max_1h_local} (${notice.max_1h_utc})</p>
  <p><strong>Media máxima 8 h:</strong> ${notice.max_8h.toFixed(1)} µg/m³</p>
  <p><strong>Pronóstico breve:</strong> ${notice.forecast}</p>
  <p style="font-size: 0.85em; color: #444; margin-top: 1em;">Este formato automatiza el contenido exigido. Unidades: µg/m³.</p>
</div>`.trim()

      void navigator.clipboard.writeText(noticeHTML)
      window.alert('Aviso copiado al portapapeles')
    } catch (err) {
      console.error('Failed to build notice HTML:', err)
      window.alert('No se pudo copiar el aviso. Inténtelo nuevamente.')
    }
  }

  if (loading && !statusForView) {
    return (
      <main id="contenido-principal">
        <div className="gov-container gov-stack">
          <header className="gov-status-header">
            <div className="gov-skeleton" style={{ width: '320px', height: '48px' }} />
            <div className="gov-status-meta">
              <span className="gov-skeleton" style={{ width: '200px', height: '18px' }} />
              <span className="gov-skeleton" style={{ width: '140px', height: '24px' }} />
            </div>
          </header>
          <section className="gov-card">
            <div className="gov-skeleton" style={{ width: '100%', height: '18px' }} />
            <div className="gov-skeleton" style={{ width: '80%', height: '18px', marginTop: '8px' }} />
          </section>
          <section className="gov-card">
            <div className="gov-skeleton" style={{ width: '100%', height: '180px' }} />
          </section>
          <section>
            <div className="gov-skeleton" style={{ width: '220px', height: '24px' }} />
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="gov-skeleton"
                style={{ width: '100%', height: '32px', marginTop: '12px' }}
              />
            ))}
          </section>
        </div>
      </main>
    )
  }

  if ((error || !statusForView) && !statusContract) {
    return (
      <main id="contenido-principal">
        <div className="gov-container gov-stack">
          <h1 className="gov-section-heading">Estado de Madrid O₃</h1>
          <div className="gov-alert gov-alert--error" role="alert">
            <strong>Error:</strong> {error || 'No hay datos disponibles'}
          </div>
          <p className="gov-body">
          Puede intentar ejecutar <code>{INGEST_ENDPOINT}</code> para forzar una actualización.
        </p>
        </div>
      </main>
    )
  }

  return (
    <main id="contenido-principal">
      {isStale && (
        <div className="gov-banner gov-banner--stale" role="alert" aria-live="polite">
          <ClockIcon className="gov-icon" aria-hidden="true" />
          <span><strong>Datos retrasados – estado congelado</strong> (edad: {dataAgeLabel})</span>
        </div>
      )}
      {coverageReduced && (
        <div className="gov-banner gov-banner--coverage" role="alert" aria-live="polite">
          <AlertTriangleIcon className="gov-icon" aria-hidden="true" />
          <span>Cobertura reducida: menos de 2 estaciones. Estado congelado.</span>
        </div>
      )}

      <div className="gov-container gov-stack">
        <h1 className="visually-hidden">Estado de Madrid O₃</h1>

        <header className="gov-status-header">
          <div className="gov-status-line">
            <span className={statusBadgeClass} role="status" aria-label={`Estado: ${statusLabel}`}>
              {statusIcon}
              <span>{statusLabel}</span>
            </span>
            {showDebounceChip && (
              <span
                className="gov-chip gov-chip--accent"
                aria-live="polite"
                aria-label={pendingChipAria ?? undefined}
              >
                confirmando…
              </span>
            )}
          </div>
          <div className="gov-status-meta">
            <p className="gov-status-meta__text">
              Actualizado a las {asOfLocal} <span className="gov-status-meta__utc">({asOfUtc})</span>
            </p>
            <span className="gov-chip" aria-label={`Edad de los datos: ${dataAgeLabel}`}>
              <ClockIcon className="gov-icon gov-icon--inline" aria-hidden="true" />
              Edad de datos: {dataAgeLabel}
                </span>
          </div>
        </header>

        {error && (
          <div className="gov-alert gov-alert--error" role="alert">
            {error}
          </div>
        )}

        <section className="gov-card gov-why-panel" aria-labelledby="panel-why">
          <div className="gov-card__field">
            <span className="gov-card__label" id="panel-why">
              Motivo
            </span>
            <p className="gov-body">
              {whySentence.split(triggerDisplayValue).map((part, idx, arr) => 
                idx < arr.length - 1 ? (
                  <React.Fragment key={idx}>
                    {part}
                    <span className="gov-numeric">{triggerDisplayValue}</span>
                  </React.Fragment>
                ) : part
              )}
            </p>
          </div>
          <div className="gov-legal">
            <span>Umbral legal: <span className="gov-numeric">{THRESHOLD_UGM3}</span> µg/m³ (1 h)</span>
            <span aria-hidden="true">•</span>
            <Link href="/madrid/methodology">Metodología</Link>
        </div>
        </section>

        <section className="gov-card" aria-labelledby="notice-heading">
          <div>
            <h2 id="notice-heading" className="gov-section-heading">
              Aviso (estilo anexo)
            </h2>
          </div>
          <div className="gov-card__grid">
            <div className="gov-card__field">
              <span className="gov-card__label">Área</span>
              <span className="gov-card__value">{noticeContent?.area ?? 'Aglomeración de Madrid'}</span>
            </div>
            <div className="gov-card__field">
              <span className="gov-card__label">Tipo</span>
              <span className="gov-card__value">Umbral de información O₃ (180 µg/m³, 1 h)</span>
            </div>
            <div className="gov-card__field">
              <span className="gov-card__label">Inicio y duración</span>
              <span className="gov-card__value">
                {noticeStartLocal ? `${noticeStartLocal} (${noticeStartUtc}) • ${noticeDuration}` : 'Sin episodio en curso'}
              </span>
            </div>
            <div className="gov-card__field">
              <span className="gov-card__label">Valor máximo 1 h</span>
              <span className="gov-card__value">
                <strong className="gov-numeric">{formatConcentration(max1hValue)} µg/m³</strong> · {max1hStation} · {max1hLocal} ({max1hUtc})
              </span>
            </div>
            <div className="gov-card__field">
              <span className="gov-card__label">Media máxima 8 h</span>
              <span className="gov-card__value">
                <strong className="gov-numeric">{max8hLabel} µg/m³</strong>
              </span>
            </div>
            <div className="gov-card__field">
              <span className="gov-card__label">Pronóstico breve</span>
              <span className="gov-card__value">
                {noticeContent?.forecast ??
                  '[Pronóstico no disponible. Consultar fuentes oficiales para información actualizada.]'}
              </span>
            </div>
          </div>
          <div className="gov-actions">
            <button className="gov-button" onClick={copyNoticeHTML} type="button" aria-label="Copiar contenido del aviso en formato HTML">
              <CopyIcon className="gov-icon gov-icon--inline" aria-hidden="true" />
            Copiar HTML
          </button>
            <a className="gov-button gov-button--quiet" href={pdfUrl} target="_blank" rel="noopener noreferrer" aria-label="Descargar aviso en formato PDF">
              <FilePdfIcon className="gov-icon gov-icon--inline" aria-hidden="true" />
            Descargar PDF
          </a>
        </div>
          <p className="gov-footnote">Este formato automatiza el contenido exigido. Unidades: µg/m³.</p>
      </section>

        <section className="gov-section">
          <h2 className="gov-section-heading">Tabla de estaciones</h2>
          {hasStations ? (
            <div className="gov-table-wrapper">
              <table className="gov-table">
                <caption className="visually-hidden">Valores horarios de estaciones representativas</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Estación</th>
                    <th scope="col" className="gov-table__numeric">
                      Valor (µg/m³)
                    </th>
                    <th scope="col">Hora local</th>
                    <th scope="col">Hora UTC</th>
                  </tr>
                </thead>
                <tbody>
                  {(statusForView?.stations || []).map((station) => {
                    const stationTime = safeFormatDateTime(station.timestamp_utc)
                    const isTriggerRow = triggerStationId ? station.id === triggerStationId : false
                    const rowClassName = isTriggerRow ? 'gov-table__trigger' : undefined
                    return (
                      <tr key={station.id} className={rowClassName} tabIndex={0} aria-label={isTriggerRow ? `Estación que disparó el umbral: ${station.name}` : undefined}>
                        <td>{station.id}</td>
                        <td>{station.name}</td>
                        <td className="gov-table__numeric" aria-label={`${formatConcentration(station.value)} microgramos por metro cúbico`}>
                          <span className="gov-numeric">{formatConcentration(station.value)}</span>
                        </td>
                        <td>{stationTime?.local || 'Sin datos'}</td>
                        <td>{stationTime?.utc || 'N/D'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="gov-body" role="status">
              Sin datos de la última hora. Consulte la metodología.
            </p>
          )}
        </section>

        {changeLogEntries.length > 0 && (
          <section>
            <h2 className="gov-section-heading">Registro de cambios</h2>
            <ol className="gov-timeline">
              {changeLogEntries.map((entry, index) => {
              const changeTime = safeFormatDateTime(entry.timestamp)
              const hourTime = safeFormatDateTime(entry.hour_utc ?? null)
                const matchingEpisode =
                  (entry.hour_utc && episodesByTrigger[entry.hour_utc]) ||
                  (entry.to_status === 'INFO_EXCEEDED' && episodesByTrigger[entry.timestamp])
                const valueLabel =
                  typeof entry.value === 'number' && Number.isFinite(entry.value)
                    ? `${formatConcentration(entry.value)} µg/m³`
                    : null
                const fromStatusLabel = entry.from_status === 'INFO_EXCEEDED' ? 'UMBRAL DE INFORMACIÓN SUPERADO' : 'EN CUMPLIMIENTO'
                const toStatusLabel = entry.to_status === 'INFO_EXCEEDED' ? 'UMBRAL DE INFORMACIÓN SUPERADO' : 'EN CUMPLIMIENTO'
                const toStatusBadgeClass = entry.to_status === 'INFO_EXCEEDED' ? 'gov-badge gov-badge--warn gov-badge--small' : 'gov-badge gov-badge--ok gov-badge--small'
                const toStatusIcon = entry.to_status === 'INFO_EXCEEDED' ? <AlertTriangleIcon className="gov-icon gov-icon--small" /> : <CheckCircleIcon className="gov-icon gov-icon--small" />
              return (
                  <li key={`${entry.timestamp}-${index}`} className="gov-timeline__item">
                    <div className="gov-timeline__header">
                      <p className="gov-timeline__time">
                        {changeTime?.local || 'Sin datos'}{' '}
                        <span className="gov-muted">({changeTime?.utc || 'N/D'})</span>
                      </p>
                      <span className={toStatusBadgeClass} role="status" aria-label={`Estado: ${toStatusLabel}`}>
                        {toStatusIcon}
                        <span>{toStatusLabel}</span>
                      </span>
                    </div>
                    <p className="gov-timeline__summary">
                      {fromStatusLabel} → {toStatusLabel}
                    </p>
                    <div className="gov-timeline__detail">
                      {entry.station_name && (
                        <p>
                          <strong>Estación:</strong> {entry.station_name}
                          {entry.station_id && <span className="gov-muted"> ({entry.station_id})</span>}
                        </p>
                      )}
                      {valueLabel && (
                        <p>
                          <strong>Valor:</strong> <span className="gov-numeric">{formatConcentration(entry.value)}</span> µg/m³
                        </p>
                      )}
                      {hourTime && (
                        <p>
                          <strong>Hora del dato:</strong> {hourTime.local} <span className="gov-muted">({hourTime.utc})</span>
                        </p>
                      )}
                      {entry.data_age_minutes_at_flip !== undefined && (
                        <p>
                          <strong>Edad de datos:</strong> {entry.data_age_minutes_at_flip} min
                        </p>
                      )}
                      {matchingEpisode && (
                        <p>
                          <a className="gov-link" href={matchingEpisode.pdf_url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir PDF congelado del episodio del ${changeTime?.local || 'episodio'}`}>
                            <FilePdfIcon className="gov-icon gov-icon--inline" aria-hidden="true" />
                            PDF congelado
                          </a>
                        </p>
                      )}
                    </div>
                  </li>
              )
            })}
            </ol>
        </section>
      )}

      {episodes.length > 0 && (
          <section>
            <h2 className="gov-section-heading">Episodios recientes</h2>
            <div className="gov-episode-list">
            {episodes.map((episode) => {
              const triggerTime = safeFormatDateTime(episode.trigger_station?.ts_utc ?? episode.as_of_utc ?? null)
                const episodeValue =
                  typeof episode.o3_max_1h_ugm3 === 'number' && Number.isFinite(episode.o3_max_1h_ugm3)
                    ? `${formatConcentration(episode.o3_max_1h_ugm3)} µg/m³`
                    : 'Sin datos'
              return (
                  <article key={episode.id} className="gov-card gov-card--subtle">
                    <div className="gov-card__field">
                      <span className="gov-card__label">Estado</span>
                      <span className="gov-card__value">{episode.status}</span>
                    </div>
                    <div className="gov-card__field">
                      <span className="gov-card__label">Disparo</span>
                      <span className="gov-card__value">
                        {episode.trigger_station ? episode.trigger_station.name : 'Sin estación'}
                        {triggerTime ? ` · ${triggerTime.local} (${triggerTime.utc})` : ''}
                      </span>
                  </div>
                    <div className="gov-card__field">
                      <span className="gov-card__label">Valor máximo</span>
                      <span className="gov-card__value">
                        {episodeValue !== 'Sin datos' ? (
                          <>
                            <span className="gov-numeric">{episodeValue.replace(' µg/m³', '')}</span> µg/m³
                          </>
                        ) : (
                          episodeValue
                        )}
                      </span>
                  </div>
                    <a href={episode.pdf_url} className="gov-link" target="_blank" rel="noopener noreferrer" aria-label={`Abrir PDF congelado del episodio ${episode.id}`}>
                      <FilePdfIcon className="gov-icon gov-icon--inline" aria-hidden="true" />
                    Abrir PDF congelado
                  </a>
                  </article>
              )
            })}
          </div>
        </section>
      )}

        <section className="gov-card gov-methodology" aria-labelledby="methodology-heading">
          <div className="gov-methodology__header">
            <InfoIcon className="gov-icon" />
            <div>
              <h2 id="methodology-heading" className="gov-section-heading">
                Metodología y descargo
              </h2>
              <p className="gov-legal">Vista previa no oficial basada en datos públicos.</p>
            </div>
          </div>
          <p className="gov-body">
            Los datos provienen de la Agencia Europea de Medio Ambiente (EEA). El PDF refleja los mismos valores que esta
            vista web para auditorías y archivo.
          </p>
          <div className="gov-actions">
            <Link href="/madrid/methodology" className="gov-button gov-button--quiet">
              <InfoIcon className="gov-icon gov-icon--inline" />
              Metodología
            </Link>
            <a href={statusJsonHref} className="gov-button gov-button--quiet">
              Ver status.json
            </a>
          </div>
      </section>

        <section className="gov-card gov-card--subtle">
          <h2 className="gov-section-heading">Modo demo</h2>
          <p className="gov-body">
            Use ejemplos para evaluar la experiencia sin esperar datos en vivo. Cambiar de estado tarda unos segundos.
          </p>
          <div className="gov-actions">
            <button
              onClick={() => void loadDemo('exceeded')}
              disabled={loading}
              className="gov-button gov-button--quiet"
              type="button"
              aria-label="Cargar ejemplo de estado: Umbral de información superado"
            >
              Demo: Umbral superado
            </button>
            <button
              onClick={() => void loadDemo('compliant')}
              disabled={loading}
              className="gov-button gov-button--quiet"
              type="button"
              aria-label="Cargar ejemplo de estado: En cumplimiento"
            >
              Demo: Cumplimiento
            </button>
          </div>
        </section>
      </div>

      {showRecoveryToast && (
        <div className="gov-toast" role="status" aria-live="polite">
          <CheckCircleIcon className="gov-icon" />
          Restablecido: &lt;180 µg/m³ durante 2 horas
        </div>
      )}
    </main>
  )
}


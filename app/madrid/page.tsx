'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ChangeLogEntry, StatusJsonContract, StatusResponse, Station, TriggerStation } from '@/types/status'
import { formatDateTimeWithUTC } from '@/lib/utils/timezone'
import { buildNoticeContent } from '@/lib/utils/notice'

const STATUS_ENDPOINT = '/api/madrid/status'
const STATUS_CONTRACT_ENDPOINT = '/madrid/status.json'
const CHANGELOG_ENDPOINT = '/api/madrid/changelog'
const INGEST_ENDPOINT = '/api/madrid/ingest'
const DEFAULT_PDF_URL = '/madrid/latest.pdf'
const STALE_THRESHOLD_MINUTES = 90

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

  useEffect(() => {
    void fetchStatus()
    void fetchChangelog()
    void fetchEpisodes()
  }, [])

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
      setError(err instanceof Error ? err.message : 'Error desconocido')
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

  const triggerValue = statusForView ? findTriggerValue(statusForView) : null
  const triggerTime = safeFormatDateTime(statusForView?.trigger_station?.ts_utc ?? statusForView?.as_of_utc ?? null)

  const max1hValue = statusForView?.max_1h?.value
  const max1hStation = statusForView?.max_1h?.station_name ?? statusForView?.trigger_station?.name ?? 'Sin datos'
  const max1hTime = safeFormatDateTime(statusForView?.max_1h?.timestamp_utc ?? statusForView?.as_of_utc ?? null)

  const episodeStartTime = safeFormatDateTime(statusForView?.episode_start ?? null)

  const copyNoticeHTML = () => {
    if (!statusForView) {
      return
    }

    try {
      const notice = buildNoticeContent(statusForView)
      const inicioHtml = notice.episode_start_local
        ? `
  <p><strong>Inicio:</strong> ${notice.episode_start_local} (${notice.episode_start_utc})</p>
  <p><strong>Duración:</strong> ${notice.duration_hours !== null ? `${notice.duration_hours} horas` : 'En curso'}</p>`
        : ''

      const noticeHTML = `
<div>
  <h2>Umbral de Información O₃</h2>
  <p><strong>Área:</strong> ${notice.area}</p>
  <p><strong>Tipo:</strong> ${notice.type}</p>${inicioHtml}
  <p><strong>Valor máx 1 h:</strong> ${formatConcentration(notice.max_1h_value)} µg/m³ en ${notice.max_1h_station}, ${notice.max_1h_local} (${notice.max_1h_utc})</p>
  <p><strong>Media máx 8 h:</strong> ${formatConcentration(notice.max_8h)} µg/m³</p>
  <p><strong>Pronóstico breve:</strong> ${notice.forecast}</p>
  <p style="font-size: 0.85em; color: #666; margin-top: 1em;">Fuente: EEA (European Environment Agency)</p>
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
      <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <p>Cargando...</p>
      </main>
    )
  }

  if ((error || !statusForView) && !statusContract) {
    return (
      <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h1>Estado de Madrid O₃</h1>
        <p style={{ color: 'red' }}>Error: {error || 'No hay datos disponibles'}</p>
        <p>
          Puede intentar ejecutar <code>{INGEST_ENDPOINT}</code> para forzar una actualización.
        </p>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Estado de Madrid O₃</h1>

      {statusForView && (
        <p style={{ marginTop: '0.5rem', color: '#555' }}>
          Última hora completa:{' '}
          {safeFormatDateTime(statusForView.as_of_utc)?.local || 'Sin datos'}{' '}
          <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
            ({safeFormatDateTime(statusForView.as_of_utc)?.utc || 'N/D'})
          </span>
        </p>
      )}

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: isExceeded ? '#ff6b6b' : '#51cf66',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
        }}
      >
        {isExceeded ? 'UMBRAL EXCEDIDO' : 'CUMPLIMIENTO'}
      </div>

      {isStale && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#ffd43b',
            borderRadius: '8px',
            border: '2px solid #ffc107',
          }}
        >
          <strong>⚠️ Datos con {statusForView?.data_age_minutes ?? 'N/D'} min de retraso;</strong> el estado está congelado hasta recibir
          datos recientes.
        </div>
      )}

      {error && statusForView && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#ffe3e3',
            borderRadius: '8px',
            border: '2px solid #ff8787',
          }}
        >
          <strong>⚠️ Incidencia de ingestión:</strong> {error}
        </div>
      )}

      {coverageReduced && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#ffd43b',
            borderRadius: '8px',
            border: '2px solid #ffc107',
          }}
        >
          <strong>⚠️ Cobertura reducida:</strong> Menos de 2 estaciones activas en la última hora. El estado se mantiene hasta
          recuperar cobertura.
        </div>
      )}

      <section style={{ marginTop: '2rem' }}>
        <h2>Por qué</h2>
        {isExceeded && statusForView?.trigger_station ? (
          <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
            <p>
              <strong>Estado activado por:</strong>
            </p>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>
                <strong>Estación:</strong> {statusForView.trigger_station.name}
              </li>
              <li>
                <strong>Valor:</strong> {formatConcentration(triggerValue)} µg/m³
              </li>
              <li>
                <strong>Hora:</strong>{' '}
                {triggerTime?.local || 'Sin datos'}{' '}
                <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
                  ({triggerTime?.utc || 'N/D'})
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <p>
            Según la Directiva (UE) 2024/2881, Anexo I Sección 4, el umbral de información para O₃ es de 180 µg/m³ (media de 1
            hora). Cuando se supera este umbral en cualquier estación representativa de la Aglomeración de Madrid, se debe
            informar al público.
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #333', borderRadius: '8px' }}>
        <h2>Aviso (Estilo Anexo)</h2>

        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>Área:</strong> Aglomeración de Madrid
          </p>
          <p>
            <strong>Tipo:</strong> Umbral de información O₃ (180 µg/m³, 1 h)
          </p>

          {statusForView?.episode_start && episodeStartTime && (
            <>
              <p>
                <strong>Inicio:</strong> {episodeStartTime.local}{' '}
                <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>({episodeStartTime.utc})</span>
              </p>
              <p>
                <strong>Duración:</strong> {statusForView.duration_hours !== null ? `${statusForView.duration_hours} horas` : 'En curso'}
              </p>
            </>
          )}

          <p>
            <strong>Valor máx 1 h:</strong>{' '}
            <span style={{ fontWeight: 'bold' }}>{formatConcentration(max1hValue)} µg/m³</span> en {max1hStation},{' '}
            {max1hTime?.local || 'Sin datos'}
            <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
              ({max1hTime?.utc || 'N/D'})
            </span>
          </p>
          <p>
            <strong>Media máx 8 h:</strong>{' '}
            <span style={{ fontWeight: 'bold' }}>{formatConcentration(statusForView?.max_8h)} µg/m³</span>
          </p>
          <p>
            <strong>Pronóstico breve:</strong> Se recomienda consultar las fuentes oficiales para información actualizada.
          </p>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={copyNoticeHTML}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#339af0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Copiar HTML
          </button>
          <a
            href={pdfUrl}
            download
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#51cf66',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            Descargar PDF
          </a>
          <a
            href={STATUS_CONTRACT_ENDPOINT}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#845ef7',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            Ver status.json
          </a>
        </div>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Tabla de Estaciones</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f3f5' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Nombre</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Valor (µg/m³)</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {(statusForView?.stations || []).map((station) => {
              const stationTime = safeFormatDateTime(station.timestamp_utc)
              const exceeded = Number.isFinite(station.value) && station.value >= 180
              return (
                <tr key={station.id} style={{ backgroundColor: exceeded ? '#ffe0e0' : 'white' }}>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{station.id}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{station.name}</td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'right',
                      border: '1px solid #ddd',
                      fontWeight: exceeded ? 'bold' : 'normal',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatConcentration(station.value)}
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                    {stationTime?.local || 'Sin datos'}
                    <br />
                    <span style={{ fontSize: '0.85em', color: '#666' }}>{stationTime?.utc || 'N/D'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {changelog.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Registro de Cambios</h2>
          <div style={{ marginTop: '1rem' }}>
            {changelog.slice(0, 10).map((entry, index) => {
              const changeTime = safeFormatDateTime(entry.timestamp)
              const hourTime = safeFormatDateTime(entry.hour_utc ?? null)
              return (
                <div
                  key={`${entry.timestamp}-${entry.to_status}-${index}`}
                  style={{ padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}
                >
                  <div>
                    <strong>{changeTime?.local || 'Sin datos'}</strong>{' '}
                    <span style={{ fontSize: '0.85em', color: '#666' }}>({changeTime?.utc || 'N/D'})</span>
                  </div>
                  <div>
                    {entry.from_status} → {entry.to_status}
                  </div>
                  <div style={{ fontSize: '0.9em', marginTop: '0.25rem' }}>
                    {entry.station_name ? (
                      <>
                        Estación: {entry.station_name}
                        {entry.value !== undefined && ` (${formatConcentration(entry.value)} µg/m³)`}
                      </>
                    ) : (
                      'Sin estación asociada'
                    )}
                    {hourTime && (
                      <>
                        {' '}
                        - Hora: {hourTime.local}{' '}
                        <span style={{ fontSize: '0.85em', color: '#666' }}>({hourTime.utc})</span>
                      </>
                    )}
                    {entry.data_age_minutes_at_flip !== undefined && (
                      <> - Edad de datos: {entry.data_age_minutes_at_flip} min</>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {episodes.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Episodios anteriores</h2>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {episodes.map((episode) => {
              const triggerTime = safeFormatDateTime(episode.trigger_station?.ts_utc ?? episode.as_of_utc ?? null)
              return (
                <div
                  key={episode.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{episode.as_of_local}</strong>
                    <span style={{ fontSize: '0.85em', color: '#666' }}>({safeFormatDateTime(episode.as_of_utc)?.utc || 'UTC'})</span>
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    {episode.trigger_station ? (
                      <>
                        Disparo en {episode.trigger_station.name}
                        {episode.o3_max_1h_ugm3 !== null && (
                          <> — {formatConcentration(episode.o3_max_1h_ugm3)} µg/m³</>
                        )}
                        {triggerTime && (
                          <>
                            {' '}a las {triggerTime.local}{' '}
                            <span style={{ fontSize: '0.85em', color: '#666' }}>({triggerTime.utc})</span>
                          </>
                        )}
                      </>
                    ) : (
                      'Sin detalles del disparo.'
                    )}
                  </div>
                  <a
                    href={episode.pdf_url}
                    style={{
                      marginTop: '0.5rem',
                      display: 'inline-block',
                      color: '#1864ab',
                      textDecoration: 'underline',
                    }}
                  >
                    Abrir PDF congelado
                  </a>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          fontSize: '0.9rem',
        }}
      >
        <strong>Descargo de responsabilidad:</strong> Esta es una vista previa no oficial. Los datos provienen de la EEA
        (European Environment Agency). Para información oficial, consulte las fuentes autorizadas.
      </section>

      <div style={{ marginTop: '2rem' }}>
        <Link href="/madrid/methodology">Ver metodología</Link>
      </div>
    </main>
  )
}


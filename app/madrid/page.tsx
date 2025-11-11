'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { StatusResponse, ChangeLogEntry } from '@/types/status'
import { formatMadridDateTime, formatDateTimeWithUTC } from '@/lib/utils/timezone'

export default function MadridPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
    fetchChangelog()
  }, [])

  const fetchStatus = async () => {
    try {
      // First try to get status
      let response = await fetch('/api/madrid/status')
      
      // If no data available (503), trigger ingest first
      if (response.status === 503) {
        // Trigger ingest to fetch fresh data
        const ingestResponse = await fetch('/api/madrid/ingest')
        if (!ingestResponse.ok) {
          throw new Error('Failed to ingest data')
        }
        // Wait a moment for state to be ready, then fetch status again
        await new Promise(resolve => setTimeout(resolve, 500))
        response = await fetch('/api/madrid/status')
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchChangelog = async () => {
    try {
      const response = await fetch('/api/madrid/changelog')
      if (response.ok) {
        const data = await response.json()
        setChangelog(data)
      }
    } catch (err) {
      console.error('Failed to fetch changelog:', err)
    }
  }

  const copyNoticeHTML = () => {
    if (!status) return
    
    const episodeStartLocal = status.episode_start ? formatDateTimeWithUTC(status.episode_start).local : null
    const episodeStartUTC = status.episode_start ? formatDateTimeWithUTC(status.episode_start).utc : null
    const max1hLocal = formatDateTimeWithUTC(status.max_1h.timestamp).local
    const max1hUTC = formatDateTimeWithUTC(status.max_1h.timestamp).utc
    
    const noticeHTML = `
<div>
  <h2>Umbral de Información O₃</h2>
  <p><strong>Área:</strong> Aglomeración de Madrid</p>
  <p><strong>Tipo:</strong> Umbral de información O₃ (180 µg/m³, 1 h)</p>
  ${status.episode_start ? `
  <p><strong>Inicio:</strong> ${episodeStartLocal} (${episodeStartUTC})</p>
  <p><strong>Duración:</strong> ${status.duration_hours ? `${status.duration_hours} horas` : 'En curso'}</p>
  ` : ''}
  <p><strong>Valor máx 1 h:</strong> ${status.max_1h.value.toFixed(1)} µg/m³ en ${status.max_1h.station}, ${max1hLocal} (${max1hUTC})</p>
  <p><strong>Media máx 8 h:</strong> ${status.max_8h.toFixed(1)} µg/m³</p>
  <p><strong>Pronóstico breve:</strong> Se recomienda consultar las fuentes oficiales para información actualizada.</p>
  <p style="font-size: 0.85em; color: #666; margin-top: 1em;">Fuente: EEA (European Environment Agency)</p>
</div>
    `.trim()
    
    navigator.clipboard.writeText(noticeHTML)
    alert('Noticia copiada al portapapeles')
  }

  if (loading) {
    return (
      <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <p>Cargando...</p>
      </main>
    )
  }

  if (error || !status) {
    return (
      <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h1>Estado de Madrid O₃</h1>
        <p style={{ color: 'red' }}>Error: {error || 'No hay datos disponibles'}</p>
        <p>Por favor, ejecute <code>/api/madrid/ingest</code> primero.</p>
      </main>
    )
  }

  const isExceeded = status.status === 'INFO_EXCEEDED'
  const isStale = status.data_age_minutes > 90
  const coverageReduced = status.coverage_reduced || false

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Estado de Madrid O₃</h1>

      {/* Status Badge */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: isExceeded ? '#ff6b6b' : '#51cf66',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
      }}>
        {isExceeded ? 'UMBRAL EXCEDIDO' : 'CUMPLIMIENTO'}
      </div>

      {/* Staleness Banner */}
      {isStale && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#ffd43b',
          borderRadius: '8px',
          border: '2px solid #ffc107',
        }}>
          <strong>⚠️ Datos con {status.data_age_minutes} min de retraso;</strong> el estado está congelado.
        </div>
      )}

      {/* Coverage Reduced Banner */}
      {coverageReduced && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#ffd43b',
          borderRadius: '8px',
          border: '2px solid #ffc107',
        }}>
          <strong>⚠️ Cobertura reducida:</strong> Menos de 2 estaciones activas en la última hora. 
          El estado está congelado hasta que se recupere la cobertura.
        </div>
      )}

      {/* Por qué section */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Por qué</h2>
        {isExceeded && status.trigger_station ? (
          <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
            <p><strong>Estado activado por:</strong></p>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li><strong>Estación:</strong> {status.trigger_station.name}</li>
              <li><strong>Valor:</strong> {status.trigger_station.value.toFixed(1)} µg/m³</li>
              <li><strong>Hora:</strong> {formatDateTimeWithUTC(status.trigger_station.ts_utc).local} 
                <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
                  ({formatDateTimeWithUTC(status.trigger_station.ts_utc).utc})
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <p>
            Según la Directiva (UE) 2024/2881, Anexo I Sección 4, el umbral de información para O₃ 
            es de 180 µg/m³ (media de 1 hora). Cuando se supera este umbral en cualquier estación 
            representativa de la Aglomeración de Madrid, se debe informar al público.
          </p>
        )}
      </section>

      {/* Annex-style Notice */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #333', borderRadius: '8px' }}>
        <h2>Aviso (Estilo Anexo)</h2>
        
        <div style={{ marginTop: '1rem' }}>
          <p><strong>Área:</strong> Aglomeración de Madrid</p>
          <p><strong>Tipo:</strong> Umbral de información O₃ (180 µg/m³, 1 h)</p>
          
          {status.episode_start && (
            <>
              <p><strong>Inicio:</strong> {formatDateTimeWithUTC(status.episode_start).local}
                <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
                  ({formatDateTimeWithUTC(status.episode_start).utc})
                </span>
              </p>
              <p><strong>Duración:</strong> {status.duration_hours ? `${status.duration_hours} horas` : 'En curso'}</p>
            </>
          )}
          
          <p><strong>Valor máx 1 h:</strong> {status.max_1h.value.toFixed(1)} µg/m³ en {status.max_1h.station}, {formatDateTimeWithUTC(status.max_1h.timestamp).local}
            <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
              ({formatDateTimeWithUTC(status.max_1h.timestamp).utc})
            </span>
          </p>
          <p><strong>Media máx 8 h:</strong> {status.max_8h} µg/m³</p>
          <p><strong>Pronóstico breve:</strong> Se recomienda consultar las fuentes oficiales para información actualizada.</p>
        </div>

        {/* Actions */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
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
          >
            Copiar HTML
          </button>
          <a
            href="/api/madrid/latest.pdf"
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
        </div>
      </section>

      {/* Station Table */}
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
            {status.stations.map((station) => (
              <tr key={station.id} style={{ backgroundColor: station.value >= 180 ? '#ffe0e0' : 'white' }}>
                <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{station.id}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{station.name}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', fontWeight: station.value >= 180 ? 'bold' : 'normal' }}>
                  {station.value.toFixed(1)}
                </td>
                <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                  {formatDateTimeWithUTC(station.timestamp).local}
                  <br />
                  <span style={{ fontSize: '0.85em', color: '#666' }}>
                    {formatDateTimeWithUTC(station.timestamp).utc}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Change Log */}
      {changelog.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Registro de Cambios</h2>
          <div style={{ marginTop: '1rem' }}>
            {changelog.slice(0, 10).map((entry, index) => {
              const timeLocal = formatDateTimeWithUTC(entry.timestamp).local
              const timeUTC = formatDateTimeWithUTC(entry.timestamp).utc
              const hourLocal = entry.hour_utc ? formatDateTimeWithUTC(entry.hour_utc).local : null
              const hourUTC = entry.hour_utc ? formatDateTimeWithUTC(entry.hour_utc).utc : null
              return (
                <div key={index} style={{ padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <div><strong>{timeLocal}</strong> <span style={{ fontSize: '0.85em', color: '#666' }}>({timeUTC})</span></div>
                  <div>{entry.from_status} → {entry.to_status}</div>
                  {entry.station_name && (
                    <div style={{ fontSize: '0.9em', marginTop: '0.25rem' }}>
                      Estación: {entry.station_name}
                      {entry.value !== undefined && ` (${entry.value.toFixed(1)} µg/m³)`}
                      {hourLocal && (
                        <span> - Hora: {hourLocal} <span style={{ fontSize: '0.85em', color: '#666' }}>({hourUTC})</span></span>
                      )}
                      {entry.data_age_minutes_at_flip !== undefined && (
                        <span> - Edad de datos: {entry.data_age_minutes_at_flip} min</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <section style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '8px', fontSize: '0.9rem' }}>
        <strong>Descargo de responsabilidad:</strong> Esta es una vista previa no oficial. 
        Los datos provienen de la EEA (European Environment Agency). 
        Para información oficial, consulte las fuentes autorizadas.
      </section>

      <div style={{ marginTop: '2rem' }}>
        <Link href="/madrid/methodology">Ver metodología</Link>
      </div>
    </main>
  )
}


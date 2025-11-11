import { NextResponse } from 'next/server'
import { getCurrentState, getHourlyData, initializeState } from '@/lib/status/store'
import { buildStatusResponse } from '@/lib/status/compute'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    initializeState()

    const currentState = getCurrentState()
    const hourlyData = getHourlyData()

    if (!currentState || hourlyData.length === 0) {
      return NextResponse.json(
        { error: 'No data available. Please run /api/madrid/ingest first.' },
        { status: 503 }
      )
    }

    const statusResponse = buildStatusResponse(currentState, hourlyData)

    // Build v1 contract response
    const response = {
      version: '1',
      zone_code: 'ES0014A',
      as_of_utc: statusResponse.latest_hour_utc,
      status: statusResponse.status,
      why: statusResponse.why || null,
      o3_max_1h_ugm3: statusResponse.max_1h.value,
      o3_max_8h_ugm3: statusResponse.max_8h,
      trigger_station: statusResponse.trigger_station ? {
        id: statusResponse.trigger_station.id,
        name: statusResponse.trigger_station.name,
        ts_utc: statusResponse.trigger_station.ts_utc,
      } : null,
      data_age_minutes: statusResponse.data_age_minutes,
      stations: statusResponse.stations.map(s => ({
        id: s.id,
        name: s.name,
        value: s.value,
        timestamp: s.timestamp,
      })),
      notice_pdf_url: '/madrid/latest.pdf',
    }

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Status JSON API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


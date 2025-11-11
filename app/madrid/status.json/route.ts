import { NextResponse } from 'next/server'
import { getCurrentState, getHourlyData, initializeState } from '@/lib/status/store'
import { buildStatusResponse } from '@/lib/status/compute'
import { toStatusJsonContract } from '@/lib/status/contract'

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
    const response = toStatusJsonContract(statusResponse)

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


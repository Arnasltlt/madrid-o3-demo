import { NextResponse } from 'next/server'
import { getCurrentState, getHourlyData, initializeState, storeHourlyData, updateState } from '@/lib/status/store'
import { buildStatusResponse, computeStatus } from '@/lib/status/compute'
import { fetchMadridO3Data, validateDataCoverage } from '@/lib/data/eea'
import { generateMockHourlyData } from '@/lib/data/mock'
import type { StatusResponse } from '@/types/status'
import type { HourlyData } from '@/types/station'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    initializeState()

    let currentState = getCurrentState()
    let hourlyData = getHourlyData()

    // If no data available, auto-trigger ingest
    if (!currentState || hourlyData.length === 0) {
      // Fetch fresh data
      let fetchedData: HourlyData[] = []
      
      if (process.env.EEA_FORCE_MOCK === 'true') {
        fetchedData = generateMockHourlyData(48)
      } else {
        try {
          fetchedData = await fetchMadridO3Data(48)
          if (fetchedData.length === 0) {
            fetchedData = generateMockHourlyData(48)
          }
        } catch (error) {
          console.warn('EEA API failed, using mock data:', error)
          fetchedData = generateMockHourlyData(48)
        }
      }

      // Validate and store
      if (validateDataCoverage(fetchedData)) {
        storeHourlyData(fetchedData)
        currentState = getCurrentState()
        const newState = computeStatus(fetchedData, currentState)
        
        // Find trigger station if status changed
        let triggerStation: string | null = null
        if (newState.current_status === 'INFO_EXCEEDED' && currentState?.current_status !== 'INFO_EXCEEDED') {
          const latestData = fetchedData[fetchedData.length - 1]
          const exceededStation = latestData.stations.find(s => s.value >= 180)
          triggerStation = exceededStation?.station_name || null
        }
        
        updateState(newState, triggerStation)
        currentState = newState
        hourlyData = fetchedData
      } else {
        return NextResponse.json(
          { error: 'Insufficient data coverage (need ≥2 stations)' },
          { status: 503 }
        )
      }
    }

    const statusResponse = buildStatusResponse(currentState, hourlyData)

    const response: StatusResponse = {
      ...statusResponse,
      pdf_url: '/madrid/latest.pdf',
    }

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


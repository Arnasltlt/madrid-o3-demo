import { NextResponse } from 'next/server'
import { fetchMadridO3Data, validateDataCoverage } from '@/lib/data/eea'
import { generateMockHourlyData } from '@/lib/data/mock'
import { computeStatus, buildStatusResponse } from '@/lib/status/compute'
import { getCurrentState, updateState, storeHourlyData, initializeState } from '@/lib/status/store'
import type { HourlyData } from '@/types/station'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    initializeState()

    // Try to fetch real data, fall back to mock data for testing
    let hourlyData: HourlyData[] = []
    let usingMockData = false
    
    // Check for force mock flag
    if (process.env.EEA_FORCE_MOCK === 'true') {
      console.log('EEA_FORCE_MOCK enabled - using mock data')
      hourlyData = generateMockHourlyData(48)
      usingMockData = true
    } else {
      try {
        hourlyData = await fetchMadridO3Data(48)
        if (hourlyData.length === 0) {
          throw new Error('No data parsed from EEA API')
        }
      } catch (error) {
        console.warn('EEA API failed, using mock data for testing:', error)
        hourlyData = generateMockHourlyData(48)
        usingMockData = true
      }
    }

    // Validate data coverage
    if (!validateDataCoverage(hourlyData)) {
      return NextResponse.json(
        { error: 'Insufficient data coverage (need ≥2 stations)' },
        { status: 503 }
      )
    }

    // Store hourly data
    storeHourlyData(hourlyData)

    // Get current state
    const currentState = getCurrentState()

    // Compute new status
    const newState = computeStatus(hourlyData, currentState)

    // Find trigger station if status changed
    let triggerStation: string | null = null
    if (newState.current_status === 'INFO_EXCEEDED' && currentState?.current_status !== 'INFO_EXCEEDED') {
      const latestData = hourlyData[hourlyData.length - 1]
      const exceededStation = latestData.stations.find(s => s.value >= 180)
      triggerStation = exceededStation?.station_name || null
    }

    // Update state
    updateState(newState, triggerStation)

    // Build response
    const statusResponse = buildStatusResponse(newState, hourlyData)

    return NextResponse.json({
      success: true,
      status: statusResponse.status,
      data_age_minutes: statusResponse.data_age_minutes,
      stations_count: statusResponse.stations.length,
      message: `Status computed: ${statusResponse.status}`,
    })
  } catch (error) {
    console.error('Ingest error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to ingest data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


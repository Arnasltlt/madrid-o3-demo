import { NextResponse } from 'next/server'
import { fetchMadridO3Data, validateDataCoverage, getLatestCompleteHourData } from '@/lib/data/eea'
import { generateMockHourlyData, generateMockExceededData, generateMockRecoveryData } from '@/lib/data/mock'
import { computeStatus, buildStatusResponse } from '@/lib/status/compute'
import { getCurrentState, updateState, storeHourlyData, initializeState, addEpisodeSnapshot } from '@/lib/status/store'
import type { HourlyData } from '@/types/station'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    initializeState()

    const url = new URL(request.url)
    const demoMode = url.searchParams.get('demo') // 'exceeded' or 'compliant' - no auth needed
    const syntheticMode = url.searchParams.get('synthetic')
    const syntheticToken = url.searchParams.get('token')
    const requiredToken = process.env.SYNTHETIC_MODE_TOKEN

    const isSyntheticRequest = syntheticMode === 'exceed' || syntheticMode === 'recover'
    const isDemoRequest = demoMode === 'exceeded' || demoMode === 'compliant'

    if (isSyntheticRequest) {
      if (requiredToken && syntheticToken !== requiredToken) {
        return NextResponse.json(
          { error: 'Unauthorized synthetic mode access' },
          { status: 401 }
        )
      }

      if (!requiredToken && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Synthetic mode disabled in production without SYNTHETIC_MODE_TOKEN' },
          { status: 403 }
        )
      }
    }

    // Try to fetch real data, fall back to mock data for testing
    let hourlyData: HourlyData[] = []
    let usingMockData = false
    
    if (isDemoRequest) {
      // Demo mode - no auth needed, bypass debounce by setting state directly
      if (demoMode === 'exceeded') {
        console.log('Demo mode: exceeded - using exceeded mock data')
        hourlyData = generateMockExceededData()
      } else {
        console.log('Demo mode: compliant - using compliant mock data')
        hourlyData = generateMockRecoveryData()
      }
      usingMockData = true
    } else if (isSyntheticRequest) {
      if (syntheticMode === 'exceed') {
        console.log('Synthetic exceedance requested - using exceeded mock data')
        hourlyData = generateMockExceededData()
      } else {
        console.log('Synthetic recovery requested - using recovery mock data')
        hourlyData = generateMockRecoveryData()
      }
      usingMockData = true
    } else if (process.env.EEA_FORCE_MOCK === 'true') {
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

    // Compute new status (bypass debounce for demo mode)
    const newState = computeStatus(hourlyData, currentState, isDemoRequest)

    // Get latest hour data for changelog
    const latestData = getLatestCompleteHourData(hourlyData)
    const hourUtc = latestData?.hour_utc
    const dataAgeMinutes = newState.data_age_minutes

    // Find trigger station name if status changed
    let triggerStation: string | null = null
    if (newState.trigger) {
      triggerStation = newState.trigger.name
    }

    // Update state
    updateState(newState, triggerStation, hourUtc, dataAgeMinutes)

    // Build response
    const statusResponse = buildStatusResponse(newState, hourlyData)

    if (statusResponse.status === 'INFO_EXCEEDED') {
      addEpisodeSnapshot(statusResponse)
    }

    return NextResponse.json({
      success: true,
      demo_mode: isDemoRequest ? demoMode : null,
      synthetic_mode: isSyntheticRequest ? syntheticMode : null,
      status: statusResponse.status,
      data_age_minutes: statusResponse.data_age_minutes,
      stations_count: statusResponse.stations.length,
      message: `Status computed: ${statusResponse.status}${isDemoRequest ? ' (demo)' : ''}`,
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


import { NextResponse } from 'next/server'
import { getEpisodeSnapshots } from '@/lib/status/store'
import { formatDateTimeWithUTC } from '@/lib/utils/timezone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const snapshots = getEpisodeSnapshots()

    const episodes = snapshots.map(({ id, snapshot }) => {
      const formattedTime = formatDateTimeWithUTC(snapshot.as_of_utc)
      return {
        id,
        status: snapshot.status,
        as_of_utc: snapshot.as_of_utc,
        as_of_local: formattedTime.local,
        trigger_station: snapshot.trigger_station
          ? {
              id: snapshot.trigger_station.id,
              name: snapshot.trigger_station.name,
              ts_utc: snapshot.trigger_station.ts_utc,
            }
          : null,
        o3_max_1h_ugm3: snapshot.max_1h?.value ?? null,
        pdf_url: `/madrid/episodes/${id}/pdf`,
      }
    })

    return NextResponse.json(episodes, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Episodes API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to list episodes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



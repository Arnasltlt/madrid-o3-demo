import { NextResponse } from 'next/server'
import { getChangeLog } from '@/lib/status/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const changelog = getChangeLog()

    return NextResponse.json(changelog, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Changelog API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get changelog',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


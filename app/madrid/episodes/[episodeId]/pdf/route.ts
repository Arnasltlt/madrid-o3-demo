import { NextResponse } from 'next/server'
import { findEpisodeSnapshot } from '@/lib/status/store'
import { generatePDF } from '@/lib/utils/pdf'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext {
  params: {
    episodeId: string
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const snapshot = findEpisodeSnapshot(params.episodeId)
    if (!snapshot) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const pdfBuffer = await generatePDF(snapshot)
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="madrid-episode-${params.episodeId}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Episode PDF error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate episode PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



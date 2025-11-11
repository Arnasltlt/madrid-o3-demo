import { NextResponse } from 'next/server'
import { getCurrentState, getHourlyData, initializeState } from '@/lib/status/store'
import { buildStatusResponse } from '@/lib/status/compute'
import { generatePDF } from '@/lib/utils/pdf'

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
    const pdfBuffer = await generatePDF({
      ...statusResponse,
      pdf_url: '/madrid/latest.pdf',
    })

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="madrid-o3-notice.pdf"',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


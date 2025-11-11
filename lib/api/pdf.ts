import { NextResponse } from 'next/server'
import { initializeState, getCurrentState, getHourlyData } from '@/lib/status/store'
import { buildStatusResponse } from '@/lib/status/compute'
import { generatePDF } from '@/lib/utils/pdf'

export async function createLatestPdfResponse(): Promise<NextResponse> {
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
  const pdfBuffer = await generatePDF(statusResponse)

  return new NextResponse(pdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="madrid-o3-notice.pdf"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}



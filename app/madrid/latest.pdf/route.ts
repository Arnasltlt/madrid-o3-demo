import { NextResponse } from 'next/server'
import { createLatestPdfResponse } from '@/lib/api/pdf'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    return await createLatestPdfResponse()
  } catch (error) {
    console.error('PDF generation error (page route):', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}



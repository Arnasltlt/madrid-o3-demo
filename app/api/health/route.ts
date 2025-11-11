import { NextResponse } from 'next/server'
import packageJson from '../../../package.json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null
  const commitShort = commitSha ? commitSha.slice(0, 7) : null

  return NextResponse.json(
    {
      status: 'ok',
      version: packageJson.version ?? 'unknown',
      timestamp: new Date().toISOString(),
      commit: commitSha,
      commit_short: commitShort,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}



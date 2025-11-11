import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Madrid O3 Information Threshold Demo',
  description: 'Monitor ozone levels in Madrid agglomeration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}


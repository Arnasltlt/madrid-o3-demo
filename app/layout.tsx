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
      <body>
        <a href="#contenido-principal" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  )
}


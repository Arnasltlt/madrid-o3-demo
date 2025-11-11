import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Madrid O3 Information Threshold Demo</h1>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/madrid">Ver estado de Madrid</Link>
      </p>
    </main>
  )
}


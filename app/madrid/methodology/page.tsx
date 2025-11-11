import Link from 'next/link'

export default function MethodologyPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Metodología</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>Fuentes de Datos</h2>
        <p>
          Los datos provienen de la Agencia Europea de Medio Ambiente (EEA):
        </p>
        <ul style={{ marginTop: '1rem', marginLeft: '2rem' }}>
          <li><strong>E2a Up-To-Date:</strong> Datos horarios de calidad del aire en tiempo casi real</li>
          <li><strong>Zones Dataset:</strong> Información sobre zonas de calidad del aire (Aglomeración de Madrid)</li>
        </ul>
        <p style={{ marginTop: '1rem' }}>
          <a href="https://www.eea.europa.eu/data-and-maps/data/air-quality-database" target="_blank" rel="noopener noreferrer">
            Más información sobre los datos de la EEA
          </a>
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Regla del Umbral</h2>
        <p>
          Según la <strong>Directiva (UE) 2024/2881, Anexo I Sección 4</strong>, el umbral de información 
          para O₃ es de <strong>180 µg/m³</strong> (media de 1 hora).
        </p>
        <p style={{ marginTop: '1rem' }}>
          Cuando cualquier estación representativa en la Aglomeración de Madrid registra un valor 
          ≥ 180 µg/m³ durante una hora completa, se considera que el umbral ha sido excedido.
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Alcance</h2>
        <ul style={{ marginLeft: '2rem' }}>
          <li><strong>Área:</strong> Aglomeración de Madrid</li>
          <li><strong>Contaminante:</strong> O₃ (ozono) únicamente</li>
          <li><strong>Granularidad:</strong> Valores horarios de estaciones de monitoreo fijas</li>
          <li><strong>Unidades:</strong> µg/m³</li>
          <li><strong>Tiempo:</strong> Última hora completa (UTC)</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Lógica de Estado</h2>
        <ul style={{ marginLeft: '2rem' }}>
          <li><strong>Detección:</strong> Si cualquier estación ≥ 180 µg/m³ → INFO_EXCEEDED. Si no, COMPLIANT.</li>
          <li><strong>Debounce:</strong> Se requieren dos verificaciones consecutivas por encima del umbral para activar la alerta.</li>
          <li><strong>Recuperación:</strong> Se necesitan dos verificaciones consecutivas por debajo de 180 µg/m³ para volver a COMPLIANT.</li>
          <li><strong>Congelación por retraso:</strong> Si los datos superan los 90 minutos de antigüedad, el estado se congela hasta recibir información fresca.</li>
          <li><strong>Regla de cobertura:</strong> Con menos de dos estaciones activas en la última hora completa no se aplican cambios de estado.</li>
          <li><strong>Por qué:</strong> Cuando INFO_EXCEEDED está activo se publica la estación, valor y hora que dispararon el aviso.</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Advertencias y Limitaciones</h2>
        <ul style={{ marginLeft: '2rem' }}>
          <li>Esta es una <strong>vista previa no oficial</strong>.</li>
          <li>Los datos dependen de la disponibilidad y calidad de los datos de la EEA.</li>
          <li>Se requiere cobertura de al menos 2 estaciones para considerar los datos válidos.</li>
          <li>Los valores se muestran en hora de Madrid (Europe/Madrid).</li>
          <li>Para información oficial y actualizada, consulte las autoridades competentes.</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Atribución</h2>
        <p>
          Datos proporcionados por la <strong>Agencia Europea de Medio Ambiente (EEA)</strong> 
          a través de sus servicios de descarga de calidad del aire.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <a href="https://www.eea.europa.eu/" target="_blank" rel="noopener noreferrer">
            Sitio web de la EEA
          </a>
        </p>
      </section>

      <div style={{ marginTop: '2rem' }}>
        <Link href="/madrid">← Volver al estado</Link>
      </div>
    </main>
  )
}


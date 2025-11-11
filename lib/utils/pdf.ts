import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { StatusResponse } from '@/types/status'
import { formatMadridDateTime } from './timezone'

export async function generatePDF(status: StatusResponse): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  let yPos = 800
  
  // Title
  page.drawText('Umbral de Informacion O3', {
    x: 50,
    y: yPos,
    size: 18,
    font: fontBold,
  })
  yPos -= 40
  
  // Área
  page.drawText('Area:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText('Aglomeracion de Madrid', {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Tipo
  page.drawText('Tipo:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText('Umbral de informacion O3 (180 ug/m3, 1 h)', {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Inicio y duración
  if (status.episode_start) {
    const inicioLocal = formatMadridDateTime(status.episode_start)
    const duracion = status.duration_hours 
      ? `${status.duration_hours} horas`
      : 'En curso'
    
    page.drawText('Inicio:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    page.drawText(inicioLocal, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
    
    page.drawText('Duracion:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    page.drawText(duracion, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
  }
  
  // Valor máx 1 h
  const max1hLocal = formatMadridDateTime(status.max_1h.timestamp)
  page.drawText('Valor max 1 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(`${status.max_1h.value} ug/m3 en ${status.max_1h.station}, ${max1hLocal}`, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Media máx 8 h
  page.drawText('Media max 8 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(`${status.max_8h} ug/m3`, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Pronóstico breve
  page.drawText('Pronostico breve:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText('Se recomienda consultar las fuentes oficiales para informacion actualizada.', {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 40
  
  // Tabla de estaciones
  page.drawText('Tabla de estaciones:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  yPos -= 25
  
  // Table header
  page.drawText('ID', {
    x: 50,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  page.drawText('Nombre', {
    x: 120,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  page.drawText('Valor (ug/m3)', {
    x: 350,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  page.drawText('Hora', {
    x: 450,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  yPos -= 20
  
  // Table rows
  status.stations.forEach((station) => {
    if (yPos < 50) {
      const newPage = pdfDoc.addPage([595.28, 841.89])
      yPos = 800
    }
    
    const horaLocal = formatMadridDateTime(station.timestamp)
    page.drawText(station.id, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
    })
    page.drawText(station.name.substring(0, 30), {
      x: 120,
      y: yPos,
      size: 10,
      font: font,
    })
    page.drawText(station.value.toFixed(1), {
      x: 350,
      y: yPos,
      size: 10,
      font: font,
    })
    page.drawText(horaLocal.substring(0, 16), {
      x: 450,
      y: yPos,
      size: 10,
      font: font,
    })
    
    yPos -= 20
  })
  
  // Footer
  const footerY = 50
  page.drawText('Vista previa no oficial. Unidades: ug/m3', {
    x: 50,
    y: footerY,
    size: 8,
    font: font,
  })
  page.drawText(`Generado: ${formatMadridDateTime(new Date().toISOString())}`, {
    x: 50,
    y: footerY - 15,
    size: 8,
    font: font,
  })
  
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createHash } from 'crypto'
import type { StatusResponse } from '@/types/status'
import { formatMadridDateTime, formatDateTimeWithUTC } from './timezone'
import { buildNoticeContent } from './notice'

export async function generatePDF(status: StatusResponse): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  // Build notice content using helper
  const notice = buildNoticeContent(status)
  
  // Generate short identifier from as_of_utc + status + max_1h timestamp
  const snapshotId = createHash('sha1')
    .update(`${status.latest_hour_utc}${status.status}${status.max_1h.timestamp}`)
    .digest('hex')
    .substring(0, 8)
  
  let yPos = 800
  
  // Title
  page.drawText('Umbral de Información O₃', {
    x: 50,
    y: yPos,
    size: 18,
    font: fontBold,
  })
  yPos -= 40
  
  // Área
  page.drawText('Área:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(notice.area, {
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
  page.drawText(notice.type, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Inicio y duración
  if (notice.episode_start_local) {
    page.drawText('Inicio:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    page.drawText(`${notice.episode_start_local} (${notice.episode_start_utc})`, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
    
    page.drawText('Duración:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    const duracion = notice.duration_hours 
      ? `${notice.duration_hours} horas`
      : 'En curso'
    page.drawText(duracion, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
  }
  
  // Valor máx 1 h
  page.drawText('Valor máx 1 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(`${notice.max_1h_value.toFixed(1)} µg/m³ en ${notice.max_1h_station}, ${notice.max_1h_local} (${notice.max_1h_utc})`, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Media máx 8 h
  page.drawText('Media máx 8 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(`${notice.max_8h.toFixed(1)} µg/m³`, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Pronóstico breve
  page.drawText('Pronóstico breve:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  page.drawText(notice.forecast, {
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
  let currentPage = page
  status.stations.forEach((station) => {
    if (yPos < 100) {
      currentPage = pdfDoc.addPage([595.28, 841.89])
      yPos = 800
    }
    
    const horaTime = formatDateTimeWithUTC(station.timestamp)
    currentPage.drawText(station.id, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
    })
    currentPage.drawText(station.name.substring(0, 30), {
      x: 120,
      y: yPos,
      size: 10,
      font: font,
    })
    currentPage.drawText(station.value.toFixed(1), {
      x: 350,
      y: yPos,
      size: 10,
      font: font,
    })
    currentPage.drawText(horaTime.local.substring(0, 16), {
      x: 450,
      y: yPos,
      size: 10,
      font: font,
    })
    
    yPos -= 20
  })
  
  // Footer with generation time and snapshot ID (on last page)
  const footerY = 50
  const generationTime = formatDateTimeWithUTC(new Date().toISOString())
  currentPage.drawText('Vista previa no oficial. Unidades: µg/m³', {
    x: 50,
    y: footerY,
    size: 8,
    font: font,
  })
  currentPage.drawText(`Generado: ${generationTime.local} (${generationTime.utc})`, {
    x: 50,
    y: footerY - 12,
    size: 8,
    font: font,
  })
  currentPage.drawText(`Ventana de datos: ${status.latest_hour_utc} | Estaciones: ${status.stations.length} | ID: ${snapshotId}`, {
    x: 50,
    y: footerY - 24,
    size: 8,
    font: font,
  })
  
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

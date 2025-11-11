import { PDFDocument, StandardFonts, type PDFPage } from 'pdf-lib'
import { createHash } from 'crypto'
import type { StatusResponse } from '@/types/status'
import { formatDateTimeWithUTC } from './timezone'
import { buildNoticeContent } from './notice'

const sanitizePdfText = (value: string): string => {
  return value
    .replace(/µg\/m³/gi, 'ug/m3')
    .replace(/µg\/m3/gi, 'ug/m3')
    .replace(/µ/gi, 'u')
    .replace(/₃/g, '3')
}

type DrawTextOptions = Parameters<PDFPage['drawText']>[1]

const drawTextSafe = (targetPage: PDFPage, text: string, options: DrawTextOptions) => {
  targetPage.drawText(sanitizePdfText(text), options)
}

export async function generatePDF(status: StatusResponse): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  // Build notice content using helper
  const notice = buildNoticeContent(status)
  
  // Generate short identifier from as_of_utc + status + max_1h timestamp
  const snapshotId = createHash('sha1')
    .update(`${status.as_of_utc}${status.status}${status.max_1h.timestamp_utc}`)
    .digest('hex')
    .substring(0, 8)
  
  let yPos = 800
  
  // Title
  drawTextSafe(page, 'Umbral de Información O₃', {
    x: 50,
    y: yPos,
    size: 18,
    font: fontBold,
  })
  yPos -= 40
  
  // Área
  drawTextSafe(page, 'Área:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  drawTextSafe(page, notice.area, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Tipo
  drawTextSafe(page, 'Tipo:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  drawTextSafe(page, notice.type, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 25
  
  // Inicio y duración
  if (notice.episode_start_local) {
    drawTextSafe(page, 'Inicio:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    drawTextSafe(page, `${notice.episode_start_local} (${notice.episode_start_utc})`, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
    
    drawTextSafe(page, 'Duración:', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
    })
    const duracion = notice.duration_hours 
      ? `${notice.duration_hours} horas`
      : 'En curso'
    drawTextSafe(page, duracion, {
      x: 100,
      y: yPos,
      size: 12,
      font: font,
    })
    yPos -= 25
  }
  
  // Valor máx 1 h
  drawTextSafe(page, 'Valor máx 1 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  drawTextSafe(page, `${notice.max_1h_value.toFixed(1)} µg/m³ en ${notice.max_1h_station}, ${notice.max_1h_local} (${notice.max_1h_utc})`, {
    x: 100,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  yPos -= 25
  
  // Media máx 8 h
  drawTextSafe(page, 'Media máx 8 h:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  drawTextSafe(page, `${notice.max_8h.toFixed(1)} µg/m³`, {
    x: 100,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  yPos -= 25
  
  // Pronóstico breve
  drawTextSafe(page, 'Pronóstico breve:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  drawTextSafe(page, notice.forecast, {
    x: 100,
    y: yPos,
    size: 12,
    font: font,
  })
  yPos -= 40
  
  // Tabla de estaciones
  drawTextSafe(page, 'Tabla de estaciones:', {
    x: 50,
    y: yPos,
    size: 12,
    font: fontBold,
  })
  yPos -= 25
  
  // Table header
  drawTextSafe(page, 'ID', {
    x: 50,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  drawTextSafe(page, 'Nombre', {
    x: 120,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  drawTextSafe(page, 'Valor (ug/m3)', {
    x: 350,
    y: yPos,
    size: 10,
    font: fontBold,
  })
  drawTextSafe(page, 'Hora', {
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
    
    const horaTime = formatDateTimeWithUTC(station.timestamp_utc)
    drawTextSafe(currentPage, station.id, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
    })
    drawTextSafe(currentPage, station.name.substring(0, 30), {
      x: 120,
      y: yPos,
      size: 10,
      font: font,
    })
    drawTextSafe(currentPage, station.value.toFixed(1), {
      x: 350,
      y: yPos,
      size: 10,
      font: font,
    })
    drawTextSafe(currentPage, horaTime.local.substring(0, 16), {
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
  drawTextSafe(currentPage, 'Vista previa no oficial. Unidades: µg/m³', {
    x: 50,
    y: footerY,
    size: 8,
    font: font,
  })
  drawTextSafe(currentPage, `Generado: ${generationTime.local} (${generationTime.utc})`, {
    x: 50,
    y: footerY - 12,
    size: 8,
    font: font,
  })
  drawTextSafe(currentPage, `Ventana de datos: ${status.as_of_utc} | Estaciones: ${status.stations.length} | ID: ${snapshotId}`, {
    x: 50,
    y: footerY - 24,
    size: 8,
    font: font,
  })
  
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

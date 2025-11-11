import { PDFDocument, StandardFonts, type PDFPage, rgb } from 'pdf-lib'
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

const THRESHOLD_UGM3 = 180

export async function generatePDF(status: StatusResponse): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const wrapText = (text: string, fontSize: number, maxWidth: number): string[] => {
    const sanitized = sanitizePdfText(text)
    const words = sanitized.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let currentLine = ''

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate
      } else {
        if (currentLine) {
          lines.push(currentLine)
        }
        currentLine = word
      }
    })

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines.length > 0 ? lines : ['']
  }

  const notice = buildNoticeContent(status)

  const snapshotId = createHash('sha1')
    .update(`${status.as_of_utc}${status.status}${status.max_1h.timestamp_utc}`)
    .digest('hex')
    .substring(0, 8)

  const pageWidth = page.getWidth()
  const pageHeight = page.getHeight()
  const margin = 50
  let yPos = pageHeight - margin

  const isExceeded = status.status === 'INFO_EXCEEDED'
  const badgeLabel = isExceeded ? 'UMBRAL DE INFORMACIÓN SUPERADO' : 'EN CUMPLIMIENTO'
  const badgeGlyph = isExceeded ? '[!]' : '[✓]'
  const badgeText = `${badgeGlyph} ${badgeLabel}`
  const zoneTitle = 'Aglomeración de Madrid · Aviso O3'

  drawTextSafe(page, zoneTitle, { x: margin, y: yPos, size: 18, font: fontBold })

  const badgeWidth = fontBold.widthOfTextAtSize(sanitizePdfText(badgeText), 12) + 16
  const badgeHeight = 24
  const badgeX = pageWidth - margin - badgeWidth
  page.drawRectangle({
    x: badgeX,
    y: yPos - badgeHeight + 4,
    width: badgeWidth,
    height: badgeHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  drawTextSafe(page, badgeText, { x: badgeX + 8, y: yPos - 6, size: 12, font: fontBold })

  yPos -= 32

  const asOf = formatDateTimeWithUTC(status.as_of_utc)
  const dataAgeLabel = Number.isFinite(status.data_age_minutes) ? `${status.data_age_minutes} min` : 'N/D'
  const asOfText = `Actualizado a las ${asOf.local} (${asOf.utc}) · Edad de datos: ${dataAgeLabel}`
  drawTextSafe(page, asOfText, { x: margin, y: yPos, size: 12, font })
  yPos -= 18

  const triggerStationName = status.trigger_station?.name ?? notice.max_1h_station
  const triggerValue = status.trigger_station?.value ?? notice.max_1h_value
  const triggerTime = formatDateTimeWithUTC(
    status.trigger_station?.ts_utc ?? status.max_1h.timestamp_utc ?? status.as_of_utc,
  )
  const comparisonSymbol = isExceeded ? '≥' : '<'
  const whyLine = `O3 ${comparisonSymbol} ${THRESHOLD_UGM3} ug/m3 en ${triggerStationName}, ${triggerValue.toFixed(
    1,
  )} ug/m3 a las ${triggerTime.local} (${triggerTime.utc}).`
  drawTextSafe(page, whyLine, { x: margin, y: yPos, size: 11, font })
  yPos -= 28

  const inicioYDuracion = notice.episode_start_local
    ? `${notice.episode_start_local} (${notice.episode_start_utc}) - ${
        notice.duration_hours !== null ? `${notice.duration_hours} horas` : 'En curso'
      }`
    : 'Sin episodio en curso'

  const noticeFields = [
    { label: 'Área', value: notice.area },
    { label: 'Tipo', value: notice.type },
    { label: 'Inicio y duración', value: inicioYDuracion },
    {
      label: 'Valor máximo 1 h',
      value: `${notice.max_1h_value.toFixed(1)} ug/m3 - ${notice.max_1h_station} - ${notice.max_1h_local} (${notice.max_1h_utc})`,
    },
    { label: 'Media máxima 8 h', value: `${notice.max_8h.toFixed(1)} ug/m3` },
    { label: 'Pronóstico breve', value: notice.forecast },
  ]

  const columnWidth = 220
  const columnGap = 40
  const columnX = [margin, margin + columnWidth + columnGap]
  const labelSize = 10
  const valueSize = 12
  const lineHeight = 14
  let currentY = yPos

  for (let row = 0; row < Math.ceil(noticeFields.length / 2); row++) {
    const rowFields = noticeFields.slice(row * 2, row * 2 + 2)
    let rowHeight = 0

    rowFields.forEach((field, columnIndex) => {
      const fieldX = columnX[columnIndex]
      drawTextSafe(page, field.label.toUpperCase(), { x: fieldX, y: currentY, size: labelSize, font: fontBold })

      const wrappedLines = wrapText(field.value, valueSize, columnWidth)
      let valueY = currentY - labelSize - 4
      wrappedLines.forEach((line) => {
        drawTextSafe(page, line, { x: fieldX, y: valueY, size: valueSize, font })
        valueY -= lineHeight
      })

      const fieldHeight = labelSize + 4 + wrappedLines.length * lineHeight
      rowHeight = Math.max(rowHeight, fieldHeight + 6)
    })

    currentY -= rowHeight
  }

  yPos = currentY - 24

  drawTextSafe(page, 'Este formato automatiza el contenido exigido. Unidades: ug/m3.', {
    x: margin,
    y: yPos,
    size: 10,
    font,
  })
  yPos -= 24

  const triggerStationId = status.trigger_station?.id ?? status.max_1h.station_id

  const tableColumns = [
    { title: 'ID', x: margin },
    { title: 'Estación', x: margin + 60 },
    { title: 'Valor (ug/m3)', x: margin + 210 },
    { title: 'Hora local', x: margin + 320 },
    { title: 'Hora UTC', x: margin + 430 },
  ]

  const tableHeaderSize = 10
  const tableRowHeight = 18

  const renderTableHeader = (targetPage: PDFPage, headerY: number) => {
    tableColumns.forEach((column) => {
      drawTextSafe(targetPage, column.title, { x: column.x, y: headerY, size: tableHeaderSize, font: fontBold })
    })
  }

  let currentPage: PDFPage = page
  renderTableHeader(currentPage, yPos)
  yPos -= tableRowHeight

  status.stations.forEach((station) => {
    if (yPos < 100) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      yPos = pageHeight - margin
      renderTableHeader(currentPage, yPos)
      yPos -= tableRowHeight
    }

    const horaTime = formatDateTimeWithUTC(station.timestamp_utc)
    const isTriggerRow = triggerStationId === station.id
    if (isTriggerRow) {
      currentPage.drawRectangle({
        x: margin - 6,
        y: yPos - 4,
        width: 2,
        height: tableRowHeight,
        color: rgb(0, 0, 0),
      })
    }

    drawTextSafe(currentPage, station.id, { x: tableColumns[0].x, y: yPos, size: 11, font })
    drawTextSafe(currentPage, station.name.substring(0, 30), { x: tableColumns[1].x, y: yPos, size: 11, font })
    drawTextSafe(currentPage, station.value.toFixed(1), { x: tableColumns[2].x, y: yPos, size: 11, font })
    drawTextSafe(currentPage, horaTime.local.substring(0, 16), { x: tableColumns[3].x, y: yPos, size: 11, font })
    drawTextSafe(currentPage, horaTime.utc.substring(0, 16), { x: tableColumns[4].x, y: yPos, size: 11, font })

    yPos -= tableRowHeight
  })

  const footerY = 50
  const generationTime = formatDateTimeWithUTC(new Date().toISOString())
  drawTextSafe(currentPage, 'Vista previa no oficial basada en datos públicos. Unidades: ug/m3.', {
    x: margin,
    y: footerY + 12,
    size: 8,
    font,
  })
  drawTextSafe(currentPage, `Generado: ${generationTime.utc} · Fuente: EEA · Hash: ${snapshotId}`, {
    x: margin,
    y: footerY,
    size: 8,
    font,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

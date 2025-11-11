declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: string | [number, number]
    margin?: number
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions)
    fontSize(size: number): PDFDocument
    font(font: string): PDFDocument
    text(text: string, x?: number, y?: number, options?: any): PDFDocument
    moveDown(lines?: number): PDFDocument
    addPage(): PDFDocument
    end(): void
    on(event: string, callback: (...args: any[]) => void): void
    widthOfString(text: string): number
    y: number
    page: {
      width: number
      height: number
    }
  }

  export = PDFDocument
}


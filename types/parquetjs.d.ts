declare module 'parquetjs' {
  export class ParquetReader {
    static openFile(file: any): Promise<ParquetReader>
    getCursor(): ParquetCursor
  }

  export interface ParquetCursor {
    next(): Promise<any>
  }
}


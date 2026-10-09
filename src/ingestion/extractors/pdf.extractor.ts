import { Injectable } from '@nestjs/common';
import { PageTextResult, PDFParse, TextResult } from 'pdf-parse';

/**
   * Извлекает текст постранично из PDF-документов.
   */
@Injectable()
export class PdfExtractor {
  async extract(content: Buffer): Promise<PageTextResult[]> {
    const parser: PDFParse = new PDFParse({ data: content });
    const result: TextResult = await parser.getText();
    await parser.destroy();
    return result.pages;
  }
}

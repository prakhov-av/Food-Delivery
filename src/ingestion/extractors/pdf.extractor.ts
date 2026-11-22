import { Injectable } from '@nestjs/common';
import type { PageTextResult, PDFParse, TextResult } from 'pdf-parse';

/**
 * Извлекает текст постранично из PDF-документов.
 *
 * Библиотека подключается лениво: pdf-parse тяжёлый, а PDF разбирают
 * только при загрузке документа. Статический импорт держал его в памяти
 * постоянно и добавлял время старта приложения.
 */
@Injectable()
export class PdfExtractor {
  async extract(content: Buffer): Promise<PageTextResult[]> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse: Parser } = require('pdf-parse') as {
      PDFParse: new (options: { data: Buffer }) => PDFParse;
    };

    const parser: PDFParse = new Parser({ data: content });
    const result: TextResult = await parser.getText();
    await parser.destroy();
    return result.pages;
  }
}

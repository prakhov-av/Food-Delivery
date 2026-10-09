import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';

/**
   * Извлекает текст из документов Microsoft Word в формате DOCX.
   */
@Injectable()
export class DocxExtractor {
  async extract(content: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer: content });
    return result.value;
  }
}

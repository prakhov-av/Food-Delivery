import { Injectable } from '@nestjs/common';

/**
   * Читает текстовые документы и преобразует содержимое в представление страниц, используемое конвейером ingestion.
   */
@Injectable()
export class TxtExtractor {
  extract(content: Buffer): string {
    return content.toString('utf-8');
  }
}

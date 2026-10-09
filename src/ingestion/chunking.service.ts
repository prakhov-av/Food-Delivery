import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { Chunk } from './types/chunk';
import { IngestDocumentDto } from './dto/ingest-document.dto';

/**
   * Разбивает очищенный текст документов на индексируемые фрагменты с перекрытием и добавляет к ним метаданные источника и доступа.
   */
@Injectable()
export class ChunkingService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  chunkBySentences(text: string): string[] {
    return text.split(/(?<=[.!?])(?: |\r?\n)+/);
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  chunkByParagraph(text: string): string[] {
    return text.split(/(?:\r?\n){2,}/);
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  chunkBySize(text: string): string[] {
    const chunkSize: number = this.getChunkSize();

    const result: string[] = [];
    const allWords: string[] = text.split(/\s+/);
    let start: number = 0;

    while (start < allWords.length) {
      const end: number = start + chunkSize;
      const chunk: string = allWords.slice(start, end).join(' ').trim();
      result.push(chunk);
      start = end;
    }

    return result;
  }
/**
   * Разбивает страницы очищенного документа на фрагменты заданного размера с перекрытием соседних фрагментов. Каждому фрагменту назначаются порядковый индекс и метаданные, необходимые для поиска, фильтрации доступа и восстановления контекста.
   * @param pages Очищенный текст документа, представленный массивом страниц.
   * @param docTitle Исходное имя документа для метаданных.
   * @param ingestDocumentDto Метаданные документа и правила доступа.
   * @returns Упорядоченный массив фрагментов для векторной индексации.
   */

  chunkBySizeWithOverlap(
    texts: string[],
    fileName: string,
    ingestDocumentDto: IngestDocumentDto,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let chunkIndex: number = 0;

    for (let i: number = 0; i < texts.length; i++) {
      const currentText: string = texts[i];

      if (currentText && currentText.trim() !== '') {
        const textParts: string[] =
          this.chunkOneTextBySizeWithOverlap(currentText);

        for (let j: number = 0; j < textParts.length; j++) {
          chunks.push(
            this.fillChunk(
              fileName,
              i + 1,
              textParts[j],
              ingestDocumentDto,
              chunkIndex++,
            ),
          );
        }
        chunkIndex++;
      }
    }

    return chunks;
  }

  private fillChunk(
    fileName: string,
    pageNumber: number,
    text: string,
    ingestDocumentDto: IngestDocumentDto,
    chunkIndex: number,
  ): Chunk {
    const chunk: Chunk = new Chunk();
    chunk.docTitle = fileName;
    chunk.page = pageNumber;
    chunk.text = text;
    chunk.documentType = ingestDocumentDto.documentType;
    chunk.allowedRoles = ingestDocumentDto.allowedRoles;
    chunk.language = ingestDocumentDto.language;
    chunk.documentVersion = ingestDocumentDto.documentVersion;
    chunk.documentId = ingestDocumentDto.documentId;
    chunk.index = chunkIndex;
    return chunk;
  }

  private chunkOneTextBySizeWithOverlap(text: string): string[] {
    const chunkSize: number = this.getChunkSize();
    const overlap: number = this.getOverlap(chunkSize);

    const result: string[] = [];
    const allWords: string[] = text.split(/\s+/);
    let start: number = 0;

    while (start < allWords.length) {
      const end: number = start + chunkSize;
      const chunk: string = allWords.slice(start, end).join(' ').trim();
      result.push(chunk);
      start = end - overlap;
    }

    return result;
  }

  private getChunkSize(): number {
    const chunkSize: number = Number(
      this.configService.getOrThrow('CHUNK_SIZE'),
    );

    if (isNaN(chunkSize) || chunkSize < 1) {
      throw new ConfigurationException('CHUNK_SIZE shout be greater then zero');
    }

    return chunkSize;
  }

  private getOverlap(chunkSize: number): number {
    const overlap: number = Number(
      this.configService.getOrThrow('CHUNK_OVERLAP'),
    );

    if (isNaN(overlap) || overlap < 1) {
      throw new ConfigurationException(
        'CHUNK_OVERLAP shout be greater then zero',
      );
    }

    if (overlap >= chunkSize) {
      throw new ConfigurationException(
        'CHUNK_OVERLAP shout be less then CHUNK_SIZE',
      );
    }

    return overlap;
  }
}

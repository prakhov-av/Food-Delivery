import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CleanService } from './clean.service';
import { ChunkingService } from './chunking.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { MultiformatExtractor } from './extractors/multiformat.extractor';
import { Chunk } from './types/chunk';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { PromptService } from '../prompts/prompt.service';
import { AiService } from '../ai/ai.service';
import { Repository } from 'typeorm';
import { QuarantineDocument } from './quarantine-document.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IngestionService {
  constructor(
    private readonly multiformatExtractor: MultiformatExtractor,
    private readonly cleanService: CleanService,
    private readonly chunkingService: ChunkingService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly promptService: PromptService,
    private readonly aiService: AiService,

    @InjectRepository(QuarantineDocument)
    private readonly quarantineRepository: Repository<QuarantineDocument>,
  ) {}

  async ingest(
    file: Express.Multer.File,
    ingestDocumentDto: IngestDocumentDto,
  ): Promise<void> {
    const pages: string[] = await this.multiformatExtractor.extract(file);

    const prompt: string = this.promptService
      .buildPromptForDocumentSafetyDetermination()
      .withDocument(pages.join('\n\n'))
      .build();

    const response: string = await this.aiService.generateResponse(prompt);

    if (this.isSafe(response)) {
      const cleanedPages: string[] = this.cleanService.cleanTexts(pages);
      const chunks: Chunk[] = this.chunkingService.chunkBySizeWithOverlap(
        cleanedPages,
        file.originalname,
        ingestDocumentDto,
      );
      await this.vectorStorageService.saveToDb(
        chunks,
        ingestDocumentDto.documentId,
        ingestDocumentDto.documentVersion,
      );

      return;
    }

    const document: QuarantineDocument = new QuarantineDocument();
    document.documentId = ingestDocumentDto.documentId;
    document.text = pages.join('\n\n');
    document.reason = 'Unsafe content';
    await this.quarantineRepository.save(document);

    // Ошибка, а не молчаливый успех: фронт покажет причину,
    // а AuditInterceptor запишет FAILED вместо SUCCESS.
    throw new UnprocessableEntityException(
      'Документ не прошёл проверку безопасности и отправлен в карантин',
    );
  }

  // Модель может ответить "safe", "Safe", "safe." или "safe\n".
  // "unsafe" и "not safe" после нормализации не равны "safe".
  private isSafe(response: string): boolean {
    return response.toLowerCase().replace(/[^a-z]/g, '') === 'safe';
  }
}

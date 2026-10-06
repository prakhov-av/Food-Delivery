import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionService } from './ingestion.service';
import { MultiformatExtractor } from './extractors/multiformat.extractor';
import { CleanService } from './clean.service';
import { ChunkingService } from './chunking.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { PromptService } from '../prompts/prompt.service';
import { AiService } from '../ai/ai.service';
import { QuarantineDocument } from './quarantine-document.entity';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { DocumentType } from './enums/document-type.enum';
import { Role } from '../users/enums/role.enum';
import { Chunk } from './types/chunk';
import { PromptBuilder } from '../prompts/prompt.builder';

const createFile = (): Express.Multer.File =>
  ({
    buffer: Buffer.from('document'),
    mimetype: 'text/plain',
    originalname: 'orders.txt',
  }) as Express.Multer.File;

const createDto = (): IngestDocumentDto => ({
  documentType: DocumentType.ORDER,
  allowedRoles: [Role.CUSTOMER],
  language: 'ru',
  documentVersion: 3,
  documentId: 'document-123',
});

describe('IngestionService', (): void => {
  let service: IngestionService;
  let multiformatExtractor: jest.Mocked<MultiformatExtractor>;
  let cleanService: jest.Mocked<CleanService>;
  let chunkingService: jest.Mocked<ChunkingService>;
  let vectorStorageService: jest.Mocked<VectorStorageService>;
  let promptService: jest.Mocked<PromptService>;
  let aiService: jest.Mocked<AiService>;
  let quarantineRepository: {
    save: jest.Mock;
  };

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: MultiformatExtractor,
          useValue: {
            extract: jest.fn(),
          },
        },
        {
          provide: CleanService,
          useValue: {
            cleanTexts: jest.fn(),
          },
        },
        {
          provide: ChunkingService,
          useValue: {
            chunkBySizeWithOverlap: jest.fn(),
          },
        },
        {
          provide: VectorStorageService,
          useValue: {
            saveToDb: jest.fn(),
          },
        },
        {
          provide: PromptService,
          useValue: {
            buildPromptForDocumentSafetyDetermination: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(QuarantineDocument),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(IngestionService);
    multiformatExtractor = module.get(MultiformatExtractor);
    cleanService = module.get(CleanService);
    chunkingService = module.get(ChunkingService);
    vectorStorageService = module.get(VectorStorageService);
    promptService = module.get(PromptService);
    aiService = module.get(AiService);
    quarantineRepository = module.get(getRepositoryToken(QuarantineDocument));
  });

  it('should ingest safe documents through extraction, cleaning, chunking and vector storage', async (): Promise<void> => {
    const pages: string[] = ['page one', 'page two'];
    const cleanedPages: string[] = ['clean page one', 'clean page two'];
    const chunks: Chunk[] = [
      {
        docTitle: 'orders.txt',
        page: 1,
        text: 'clean page one',
        documentType: DocumentType.ORDER,
        allowedRoles: [Role.CUSTOMER],
        language: 'ru',
        documentVersion: 3,
        documentId: 'document-123',
        index: 0,
      },
    ];

    const promptBuilder: PromptBuilder = new PromptBuilder('safety prompt');

    multiformatExtractor.extract.mockResolvedValue(pages);
    promptService.buildPromptForDocumentSafetyDetermination.mockReturnValue(
      promptBuilder,
    );
    aiService.generateResponse.mockResolvedValue('safe');
    cleanService.cleanTexts.mockReturnValue(cleanedPages);
    chunkingService.chunkBySizeWithOverlap.mockReturnValue(chunks);
    vectorStorageService.saveToDb.mockResolvedValue();

    await service.ingest(createFile(), createDto());

    expect(multiformatExtractor.extract).toHaveBeenCalledWith(createFile());
    expect(
      promptService.buildPromptForDocumentSafetyDetermination,
    ).toHaveBeenCalledTimes(1);
    const generatedPrompt: string = aiService.generateResponse.mock
      .calls[0][0] as string;

    expect(generatedPrompt).toBe(promptBuilder.build());
    expect(generatedPrompt).toContain('page one');
    expect(generatedPrompt).toContain('page two');
    expect(cleanService.cleanTexts).toHaveBeenCalledWith(pages);
    expect(chunkingService.chunkBySizeWithOverlap).toHaveBeenCalledWith(
      cleanedPages,
      'orders.txt',
      createDto(),
    );
    expect(vectorStorageService.saveToDb).toHaveBeenCalledWith(
      chunks,
      'document-123',
      3,
    );
    expect(quarantineRepository.save).not.toHaveBeenCalled();
  });

  it('should put unsafe documents into quarantine, reject with 422 and stop the normal ingestion pipeline', async (): Promise<void> => {
    const pages: string[] = ['unsafe content'];
    const promptBuilder: PromptBuilder = new PromptBuilder('safety prompt');

    multiformatExtractor.extract.mockResolvedValue(pages);
    promptService.buildPromptForDocumentSafetyDetermination.mockReturnValue(
      promptBuilder,
    );
    aiService.generateResponse.mockResolvedValue('unsafe');
    quarantineRepository.save.mockResolvedValue({});

    await expect(
      service.ingest(createFile(), createDto()),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(quarantineRepository.save).toHaveBeenCalledTimes(1);
    expect(quarantineRepository.save).toHaveBeenCalledWith({
      documentId: 'document-123',
      text: 'unsafe content',
      reason: 'Unsafe content',
    });

    expect(cleanService.cleanTexts).not.toHaveBeenCalled();
    expect(chunkingService.chunkBySizeWithOverlap).not.toHaveBeenCalled();
    expect(vectorStorageService.saveToDb).not.toHaveBeenCalled();
  });

  it.each(['Safe', 'safe.', ' safe\n', 'SAFE'])(
    'should treat the model verdict %j as safe',
    async (verdict: string): Promise<void> => {
      const pages: string[] = ['normal content'];

      multiformatExtractor.extract.mockResolvedValue(pages);
      promptService.buildPromptForDocumentSafetyDetermination.mockReturnValue(
        new PromptBuilder('safety prompt'),
      );
      aiService.generateResponse.mockResolvedValue(verdict);
      cleanService.cleanTexts.mockReturnValue(pages);
      chunkingService.chunkBySizeWithOverlap.mockReturnValue([]);
      vectorStorageService.saveToDb.mockResolvedValue();

      await service.ingest(createFile(), createDto());

      expect(vectorStorageService.saveToDb).toHaveBeenCalledTimes(1);
      expect(quarantineRepository.save).not.toHaveBeenCalled();
    },
  );

  it.each(['unsafe', 'Unsafe.', 'not safe', 'I cannot tell', ''])(
    'should quarantine the model verdict %j',
    async (verdict: string): Promise<void> => {
      multiformatExtractor.extract.mockResolvedValue(['content']);
      promptService.buildPromptForDocumentSafetyDetermination.mockReturnValue(
        new PromptBuilder('safety prompt'),
      );
      aiService.generateResponse.mockResolvedValue(verdict);
      quarantineRepository.save.mockResolvedValue({});

      await expect(
        service.ingest(createFile(), createDto()),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(quarantineRepository.save).toHaveBeenCalledTimes(1);
      expect(vectorStorageService.saveToDb).not.toHaveBeenCalled();
    },
  );

  it('should preserve page order when building the safety prompt', async (): Promise<void> => {
    const pages: string[] = ['first page', 'second page', 'third page'];
    const promptBuilder: PromptBuilder = new PromptBuilder('combined prompt');

    multiformatExtractor.extract.mockResolvedValue(pages);
    promptService.buildPromptForDocumentSafetyDetermination.mockReturnValue(
      promptBuilder,
    );
    aiService.generateResponse.mockResolvedValue('safe');
    cleanService.cleanTexts.mockReturnValue(pages);
    chunkingService.chunkBySizeWithOverlap.mockReturnValue([]);
    vectorStorageService.saveToDb.mockResolvedValue();

    await service.ingest(createFile(), createDto());

    const builder: PromptBuilder =
      promptService.buildPromptForDocumentSafetyDetermination.mock.results[0]
        .value;

    expect(builder).toBe(promptBuilder);
    const generatedPrompt: string = aiService.generateResponse.mock
      .calls[0][0] as string;

    expect(generatedPrompt).toBe(promptBuilder.build());
    expect(generatedPrompt.indexOf('first page')).toBeLessThan(
      generatedPrompt.indexOf('second page'),
    );
    expect(generatedPrompt.indexOf('second page')).toBeLessThan(
      generatedPrompt.indexOf('third page'),
    );
  });
});

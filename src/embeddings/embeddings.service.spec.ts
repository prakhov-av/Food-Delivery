import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from '../ai/ai.service';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService', (): void => {
  let service: EmbeddingsService;
  let aiService: jest.Mocked<AiService>;

  beforeEach(async (): Promise<void> => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: AiService,
          useValue: {
            generateEmbeddings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    aiService = module.get<AiService>(AiService) as jest.Mocked<AiService>;
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should be defined', (): void => {
    expect(service).toBeDefined();
  });

  it('should generate embeddings and return them', async (): Promise<void> => {
    const texts: string[] = ['first text', 'second text'];

    const embeddings: number[][] = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];

    aiService.generateEmbeddings.mockResolvedValue(embeddings);

    const result: number[][] = await service.generateEmbeddings(texts);

    expect(aiService.generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(aiService.generateEmbeddings).toHaveBeenCalledWith(texts);
    expect(result).toBe(embeddings);
  });

  it('should return an empty array when AiService returns no embeddings', async (): Promise<void> => {
    const texts: string[] = [];

    aiService.generateEmbeddings.mockResolvedValue([]);

    const result: number[][] = await service.generateEmbeddings(texts);

    expect(aiService.generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(aiService.generateEmbeddings).toHaveBeenCalledWith(texts);
    expect(result).toEqual([]);
  });

  it('should propagate an error from AiService', async (): Promise<void> => {
    const texts: string[] = ['text'];
    const error: Error = new Error('Embedding generation failed');

    aiService.generateEmbeddings.mockRejectedValue(error);

    await expect(service.generateEmbeddings(texts)).rejects.toBe(error);

    expect(aiService.generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(aiService.generateEmbeddings).toHaveBeenCalledWith(texts);
  });
});

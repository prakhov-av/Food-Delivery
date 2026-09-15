import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { AiService } from '../ai/ai.service';
import { PromptService } from '../prompts/prompt.service';
import { LiveDataService } from './live-data.service';
import { ContextService } from './context.service';
import { Role } from '../users/enums/role.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { PromptBuilder } from '../prompts/prompt.builder';
import { QdrantResult } from '../vector-storage/qdrant/types/search/qdrant-result';

const createPromptBuilder = (prompt: string): PromptBuilder => {
  return new PromptBuilder(prompt);
};

const createQdrantResult = (text: string, index: number = 0): QdrantResult => {
  const result: QdrantResult = new QdrantResult();

  result.id = `chunk-${index}`;
  result.version = 1;
  result.score = 0.95;
  result.payload = {
    text,
    docTitle: 'orders.md',
    page: 1,
    documentType: DocumentType.ORDER,
    allowedRoles: [Role.CUSTOMER],
    language: 'en',
    documentVersion: 1,
    documentId: 'document-1',
    index,
  };

  return result;
};

describe('ChatService', (): void => {
  let service: ChatService;
  let embeddingsService: jest.Mocked<EmbeddingsService>;
  let vectorStorageService: jest.Mocked<VectorStorageService>;
  let aiService: jest.Mocked<AiService>;
  let promptService: jest.Mocked<PromptService>;
  let liveDataService: jest.Mocked<LiveDataService>;
  let contextService: jest.Mocked<ContextService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: EmbeddingsService,
          useValue: {
            generateEmbeddings: jest.fn(),
          },
        },
        {
          provide: VectorStorageService,
          useValue: {
            getRelevantChunkByAccess: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
        {
          provide: PromptService,
          useValue: {
            buildPromptForDocumentType: jest.fn(),
            buildPromptForChat: jest.fn(),
          },
        },
        {
          provide: LiveDataService,
          useValue: {
            getLiveData: jest.fn(),
          },
        },
        {
          provide: ContextService,
          useValue: {
            generateContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ChatService);
    embeddingsService = module.get(EmbeddingsService);
    vectorStorageService = module.get(VectorStorageService);
    aiService = module.get(AiService);
    promptService = module.get(PromptService);
    liveDataService = module.get(LiveDataService);
    contextService = module.get(ContextService);

    contextService.generateContext.mockReturnValue([]);
  });

  it('should use RAG flow for informational request and keep history', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    promptService.buildPromptForChat.mockReturnValue(
      createPromptBuilder('answer prompt'),
    );

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('final answer');

    embeddingsService.generateEmbeddings.mockResolvedValue([[1, 2, 3]]);

    const relevantChunks: QdrantResult[] = [createQdrantResult('order rules')];

    vectorStorageService.getRelevantChunkByAccess.mockResolvedValue(
      relevantChunks,
    );

    contextService.generateContext.mockReturnValue(['order rules']);

    const result: string = await service.generateResponse(
      'Какие статусы бывают у заказа?',
      10,
      Role.CUSTOMER,
    );

    expect(result).toBe('final answer');

    expect(embeddingsService.generateEmbeddings).toHaveBeenCalledWith([
      'Какие статусы бывают у заказа?',
    ]);

    expect(vectorStorageService.getRelevantChunkByAccess).toHaveBeenCalledWith(
      [1, 2, 3],
      DocumentType.ORDER,
      Role.CUSTOMER,
    );

    expect(contextService.generateContext).toHaveBeenCalledWith(relevantChunks);

    expect(promptService.buildPromptForChat).toHaveBeenCalled();

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('second answer');

    await service.generateResponse(
      'А какие из них финальные?',
      10,
      Role.CUSTOMER,
    );

    const classifierPrompt = aiService.generateResponse.mock.calls[2][0];

    expect(classifierPrompt).toContain('Какие статусы бывают у заказа?');
    expect(classifierPrompt).toContain('final answer');
    expect(liveDataService.getLiveData).not.toHaveBeenCalled();
  });

  it('should keep history isolated by user', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockImplementation(() =>
      createPromptBuilder('classifier'),
    );

    promptService.buildPromptForChat.mockImplementation(() =>
      createPromptBuilder('answer'),
    );

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('user 10 answer')
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('user 20 answer');

    embeddingsService.generateEmbeddings.mockResolvedValue([[1, 2, 3]]);

    vectorStorageService.getRelevantChunkByAccess.mockResolvedValue([]);

    contextService.generateContext.mockReturnValue([]);

    await service.generateResponse('Вопрос пользователя 10', 10, Role.CUSTOMER);

    await service.generateResponse('Вопрос пользователя 20', 20, Role.CUSTOMER);

    const secondClassifierPrompt = aiService.generateResponse.mock.calls[2][0];

    expect(secondClassifierPrompt).not.toContain('Вопрос пользователя 10');

    expect(secondClassifierPrompt).not.toContain('user 10 answer');
  });

  it('should use live data flow and save its response to history', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":true,"resource":"ORDER","resourceId":123}',
    );

    liveDataService.getLiveData.mockResolvedValue('Статус: NEW');

    const result: string = await service.generateResponse(
      'Какой статус заказа 123?',
      10,
      Role.CUSTOMER,
    );

    expect(result).toBe('Статус: NEW');

    expect(liveDataService.getLiveData).toHaveBeenCalledWith(
      {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: 'ORDER',
        resourceId: 123,
      },
      10,
      Role.CUSTOMER,
    );

    expect(embeddingsService.generateEmbeddings).not.toHaveBeenCalled();

    expect(
      vectorStorageService.getRelevantChunkByAccess,
    ).not.toHaveBeenCalled();

    expect(contextService.generateContext).not.toHaveBeenCalled();
  });

  it('should reject invalid document type', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"UNKNOWN","liveDataRequired":false}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject non-boolean liveDataRequired', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":"true"}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });
});

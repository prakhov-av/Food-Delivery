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
import { LiveDataResource } from './enums/live-data-resource.enum';
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

  it('should use live data as context and generate a final AI response', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    promptService.buildPromptForChat.mockReturnValue(
      createPromptBuilder('answer prompt'),
    );

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":true,"resource":"ORDER","resourceId":123}',
      )
      .mockResolvedValueOnce('Заказ №123 сейчас готовится.');

    liveDataService.getLiveData.mockResolvedValue(
      'Заказ №123\nСтатус: COOKING',
    );

    const result: string = await service.generateResponse(
      'Какой статус заказа 123?',
      10,
      Role.CUSTOMER,
    );

    expect(result).toBe('Заказ №123 сейчас готовится.');

    expect(liveDataService.getLiveData).toHaveBeenCalledWith(
      {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: LiveDataResource.ORDER,
        resourceId: 123,
      },
      10,
      Role.CUSTOMER,
    );

    expect(promptService.buildPromptForChat).toHaveBeenCalled();
    expect(aiService.generateResponse).toHaveBeenCalledTimes(2);

    const finalPrompt = aiService.generateResponse.mock.calls[1][0];

    expect(finalPrompt).toContain('Заказ №123');
    expect(finalPrompt).toContain('Статус: COOKING');
    expect(finalPrompt).toContain('Какой статус заказа 123?');

    expect(embeddingsService.generateEmbeddings).not.toHaveBeenCalled();
    expect(
      vectorStorageService.getRelevantChunkByAccess,
    ).not.toHaveBeenCalled();
    expect(contextService.generateContext).not.toHaveBeenCalled();
  });

  it('should use live order list as context and generate a final AI response', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    promptService.buildPromptForChat.mockReturnValue(
      createPromptBuilder('answer prompt'),
    );

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":true,"resource":"ORDER"}',
      )
      .mockResolvedValueOnce('У вас два текущих заказа.');

    liveDataService.getLiveData.mockResolvedValue(
      'Заказ №1\nСтатус: ACCEPTED\n\nЗаказ №4\nСтатус: COOKING',
    );

    const result: string = await service.generateResponse(
      'Какие у меня есть заказы?',
      10,
      Role.CUSTOMER,
    );

    expect(result).toBe('У вас два текущих заказа.');

    expect(liveDataService.getLiveData).toHaveBeenCalledWith(
      {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: LiveDataResource.ORDER,
      },
      10,
      Role.CUSTOMER,
    );

    const finalPrompt = aiService.generateResponse.mock.calls[1][0];

    expect(finalPrompt).toContain('Заказ №1');
    expect(finalPrompt).toContain('Заказ №4');
    expect(finalPrompt).toContain('Какие у меня есть заказы?');

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

  it('should reject malformed JSON classification', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue('{invalid-json');

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject classification when parsed value is not an object', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue('null');

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject classification when required fields are missing', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue('{"documentType":"ORDER"}');

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should normalize a valid document type returned with spaces and lowercase letters', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    promptService.buildPromptForChat.mockReturnValue(
      createPromptBuilder('answer'),
    );

    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"  order  ","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('answer');

    embeddingsService.generateEmbeddings.mockResolvedValue([[1, 2, 3]]);
    vectorStorageService.getRelevantChunkByAccess.mockResolvedValue([]);
    contextService.generateContext.mockReturnValue([]);

    await service.generateResponse('question', 10, Role.CUSTOMER);

    expect(vectorStorageService.getRelevantChunkByAccess).toHaveBeenCalledWith(
      [1, 2, 3],
      DocumentType.ORDER,
      Role.CUSTOMER,
    );
  });

  it('should reject non-string document type', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":123,"liveDataRequired":false}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject invalid live data resource', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":true,"resource":"USER","resourceId":1}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it.each([
    ['a string', '"123"'],
    ['a fractional number', '1.5'],
    ['zero', '0'],
    ['a negative number', '-1'],
  ])(
    'should reject invalid live data resourceId when it is %s',
    async (_caseName, resourceId): Promise<void> => {
      promptService.buildPromptForDocumentType.mockReturnValue(
        createPromptBuilder('classifier'),
      );

      aiService.generateResponse.mockResolvedValue(
        `{"documentType":"ORDER","liveDataRequired":true,"resource":"ORDER","resourceId":${resourceId}}`,
      );

      await expect(
        service.generateResponse('question', 10, Role.CUSTOMER),
      ).rejects.toBeInstanceOf(ConfigurationException);
    },
  );

  it('should reject resourceId without resource', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":false,"resourceId":123}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject live data classification without resource', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":true}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject live data fields when liveDataRequired is false', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":false,"resource":"ORDER"}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject ORDER live data resource for a non-ORDER document type', async (): Promise<void> => {
    promptService.buildPromptForDocumentType.mockReturnValue(
      createPromptBuilder('classifier'),
    );

    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"USER","liveDataRequired":true,"resource":"ORDER","resourceId":123}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });
});

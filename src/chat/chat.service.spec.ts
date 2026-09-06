import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { AiService } from '../ai/ai.service';
import { PromptService } from './prompt.service';
import { LiveDataService } from './live-data.service';
import { Role } from '../users/enums/role.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { ConfigurationException } from '../exceptions/types/configuration.exception';

describe('ChatService', (): void => {
  let service: ChatService;
  let embeddingsService: jest.Mocked<EmbeddingsService>;
  let vectorStorageService: jest.Mocked<VectorStorageService>;
  let aiService: jest.Mocked<AiService>;
  let promptService: jest.Mocked<PromptService>;
  let liveDataService: jest.Mocked<LiveDataService>;

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
            createPromptForDocumentType: jest.fn(),
            createPromptForUserRequest: jest.fn(),
          },
        },
        {
          provide: LiveDataService,
          useValue: {
            getLiveData: jest.fn(),
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
  });

  it('should use RAG flow for informational request', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse
      .mockResolvedValueOnce(
        '{"documentType":"ORDER","liveDataRequired":false}',
      )
      .mockResolvedValueOnce('final answer');
    embeddingsService.generateEmbeddings.mockResolvedValue([[1, 2, 3]]);
    vectorStorageService.getRelevantChunkByAccess.mockResolvedValue([
      'order rules',
    ]);
    promptService.createPromptForUserRequest.mockReturnValue('answer prompt');

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
    expect(liveDataService.getLiveData).not.toHaveBeenCalled();
  });

  it('should use live data flow without embedding for live request', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
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
    expect(vectorStorageService.getRelevantChunkByAccess).not.toHaveBeenCalled();
  });

  it('should reject invalid document type', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"UNKNOWN","liveDataRequired":false}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject non-boolean liveDataRequired', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":"true"}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });
  it('should reject live classification without resource', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":true}',
    );

    await expect(
      service.generateResponse('Где мой заказ?', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject resource in non-live classification', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"ORDER","liveDataRequired":false,"resource":"ORDER","resourceId":123}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

  it('should reject resource-document type mismatch', async (): Promise<void> => {
    promptService.createPromptForDocumentType.mockReturnValue('classifier');
    aiService.generateResponse.mockResolvedValue(
      '{"documentType":"MENU","liveDataRequired":true,"resource":"ORDER","resourceId":123}',
    );

    await expect(
      service.generateResponse('question', 10, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(ConfigurationException);
  });

});

import { ConfigService } from '@nestjs/config';

import { AiService } from './ai.service';
import { GeminiClient } from './clients/gemini.client';
import { OpenAiClient } from './clients/openai.client';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { GeminiChatRequest } from './types/gemini/gemini-chat-request';
import { GeminiEmbedRequest } from './types/gemini/gemini-embed-request';
import { OpenAiRequest } from './types/openai/openai-request';

describe('AiService', (): void => {
  let service: AiService;
  let geminiClient: jest.Mocked<GeminiClient>;
  let openAiClient: jest.Mocked<OpenAiClient>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach((): void => {
    jest.clearAllMocks();

    geminiClient = {
      generateContent: jest.fn(),
      generateEmbedding: jest.fn(),
    } as unknown as jest.Mocked<GeminiClient>;

    openAiClient = {
      generateContent: jest.fn(),
      generateEmbeddings: jest.fn(),
    } as unknown as jest.Mocked<OpenAiClient>;

    configService = {
      getOrThrow: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    service = new AiService(geminiClient, openAiClient, configService);
  });

  describe('generateResponse', (): void => {
    it('should generate response through Gemini by default', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any =>
          key === 'PRIMARY_GENERATION_AI_PROVIDER'
            ? defaultValue
            : undefined,
      );
      geminiClient.generateContent.mockResolvedValue('gemini answer');

      const result: string = await service.generateResponse('hello');

      expect(result).toBe('gemini answer');
      expect(geminiClient.generateContent).toHaveBeenCalledTimes(1);
      expect(geminiClient.generateContent).toHaveBeenCalledWith(
        expect.objectContaining<GeminiChatRequest>({
          contents: [
            expect.objectContaining({
              parts: [expect.objectContaining({ text: 'hello' })],
            }),
          ],
        }),
      );
      expect(openAiClient.generateContent).not.toHaveBeenCalled();
    });

    it('should generate response through OpenAI', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any => {
          if (key === 'PRIMARY_GENERATION_AI_PROVIDER') {
            return 'openai';
          }

          if (key === 'OPENAI_MODEL') {
            return 'gpt-test';
          }

          return defaultValue;
        },
      );
      openAiClient.generateContent.mockResolvedValue('openai answer');

      const result: string = await service.generateResponse('hello');

      expect(result).toBe('openai answer');
      expect(openAiClient.generateContent).toHaveBeenCalledTimes(1);
      expect(openAiClient.generateContent).toHaveBeenCalledWith(
        expect.objectContaining<OpenAiRequest>({
          model: 'gpt-test',
          input: 'hello',
        }),
      );
      expect(geminiClient.generateContent).not.toHaveBeenCalled();
    });

    it('should throw ConfigurationException for an unsupported generation provider', async (): Promise<void> => {
      configService.getOrThrow.mockReturnValue('unsupported');

      await expect(service.generateResponse('hello')).rejects.toBeInstanceOf(
        ConfigurationException,
      );
      await expect(service.generateResponse('hello')).rejects.toThrow(
        'unsupported generation AI provider is not supported',
      );
      expect(geminiClient.generateContent).not.toHaveBeenCalled();
      expect(openAiClient.generateContent).not.toHaveBeenCalled();
    });

    it('should propagate an error from Gemini', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any =>
          key === 'PRIMARY_GENERATION_AI_PROVIDER'
            ? defaultValue
            : undefined,
      );
      const error: Error = new Error('Gemini failed');
      geminiClient.generateContent.mockRejectedValue(error);

      await expect(service.generateResponse('hello')).rejects.toBe(error);
    });
  });

  describe('generateEmbeddings', (): void => {
    it('should generate Gemini embeddings one text at a time', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any =>
          key === 'PRIMARY_EMBEDDINGS_AI_PROVIDER'
            ? defaultValue
            : undefined,
      );
      geminiClient.generateEmbedding
        .mockResolvedValueOnce([0.1, 0.2])
        .mockResolvedValueOnce([0.3, 0.4]);

      const result: number[][] = await service.generateEmbeddings([
        'first',
        'second',
      ]);

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(geminiClient.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(geminiClient.generateEmbedding).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining<GeminiEmbedRequest>({
          content: expect.objectContaining({
            parts: [expect.objectContaining({ text: 'first' })],
          }),
        }),
      );
      expect(geminiClient.generateEmbedding).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining<GeminiEmbedRequest>({
          content: expect.objectContaining({
            parts: [expect.objectContaining({ text: 'second' })],
          }),
        }),
      );
      expect(openAiClient.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('should return an empty array for empty Gemini input', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any =>
          key === 'PRIMARY_EMBEDDINGS_AI_PROVIDER'
            ? defaultValue
            : undefined,
      );

      const result: number[][] = await service.generateEmbeddings([]);

      expect(result).toEqual([]);
      expect(geminiClient.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should generate embeddings through OpenAI', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any => {
          if (key === 'PRIMARY_EMBEDDINGS_AI_PROVIDER') {
            return 'openai';
          }

          if (key === 'OPENAI_EMBEDDING_MODEL') {
            return 'embedding-test';
          }

          return defaultValue;
        },
      );
      openAiClient.generateEmbeddings.mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);

      const texts: string[] = ['first', 'second'];
      const result: number[][] = await service.generateEmbeddings(texts);

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(openAiClient.generateEmbeddings).toHaveBeenCalledTimes(1);
      expect(openAiClient.generateEmbeddings).toHaveBeenCalledWith(
        expect.objectContaining<OpenAiRequest>({
          model: 'embedding-test',
          input: texts,
        }),
      );
      expect(geminiClient.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should throw ConfigurationException for an unsupported embeddings provider', async (): Promise<void> => {
      configService.getOrThrow.mockReturnValue('unsupported');

      await expect(service.generateEmbeddings(['text'])).rejects.toBeInstanceOf(
        ConfigurationException,
      );
      await expect(service.generateEmbeddings(['text'])).rejects.toThrow(
        'unsupported embeddings AI provider is not supported',
      );
      expect(geminiClient.generateEmbedding).not.toHaveBeenCalled();
      expect(openAiClient.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('should propagate an error from Gemini embeddings', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any =>
          key === 'PRIMARY_EMBEDDINGS_AI_PROVIDER'
            ? defaultValue
            : undefined,
      );
      const error: Error = new Error('Embedding failed');
      geminiClient.generateEmbedding.mockRejectedValue(error);

      await expect(service.generateEmbeddings(['text'])).rejects.toBe(error);
    });

    it('should propagate an error from OpenAI embeddings', async (): Promise<void> => {
      configService.getOrThrow.mockImplementation(
        (key: string, defaultValue?: unknown): any => {
          if (key === 'PRIMARY_EMBEDDINGS_AI_PROVIDER') {
            return 'openai';
          }

          if (key === 'OPENAI_EMBEDDING_MODEL') {
            return 'embedding-test';
          }

          return defaultValue;
        },
      );
      const error: Error = new Error('OpenAI embeddings failed');
      openAiClient.generateEmbeddings.mockRejectedValue(error);

      await expect(service.generateEmbeddings(['text'])).rejects.toBe(error);
    });
  });
});

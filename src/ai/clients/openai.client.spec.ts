import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { OpenAiClient } from './openai.client';
import { OpenAiRequest } from '../types/openai/openai-request';
import { OpenAiResponse } from '../types/openai/openai-response';
import { OpenAiEmbeddingsResponse } from '../types/openai/openai-embeddings-response';

describe('OpenAiClient', (): void => {
  let client: OpenAiClient;
  let configService: jest.Mocked<ConfigService>;

  beforeEach((): void => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    client = new OpenAiClient(configService);
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should generate content with the configured URL and authorization header', async (): Promise<void> => {
    const request: OpenAiRequest = {
      model: 'gpt-test',
      input: 'hello',
    };
    const response: OpenAiResponse = {
      output: [
        {
          content: [{ text: 'OpenAI answer' }],
        },
      ],
    };

    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'OPENAI_API_URL') {
        return 'https://openai.test/responses';
      }
      return 'secret-key';
    });

    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: response } as never);

    const result: string = await client.generateContent(request);

    expect(result).toBe('OpenAI answer');
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      'https://openai.test/responses',
      request,
      {
        headers: {
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('should generate embeddings and map response data to vectors', async (): Promise<void> => {
    const request: OpenAiRequest = {
      model: 'embedding-test',
      input: ['first', 'second'],
    };
    const response: OpenAiEmbeddingsResponse = {
      data: [
        { embedding: [0.1, 0.2] },
        { embedding: [0.3, 0.4] },
      ],
    };

    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'OPENAI_EMBEDDING_URL') {
        return 'https://openai.test/embeddings';
      }
      return 'secret-key';
    });

    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: response } as never);

    const result: number[][] = await client.generateEmbeddings(request);

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      'https://openai.test/embeddings',
      request,
      {
        headers: {
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('should return an empty embedding list when OpenAI returns no data', async (): Promise<void> => {
    const request: OpenAiRequest = {
      model: 'embedding-test',
      input: [],
    };
    const response: OpenAiEmbeddingsResponse = {
      data: [],
    };

    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'OPENAI_EMBEDDING_URL') {
        return 'https://openai.test/embeddings';
      }
      return 'secret-key';
    });

    jest.spyOn(axios, 'post').mockResolvedValue({ data: response } as never);

    await expect(client.generateEmbeddings(request)).resolves.toEqual([]);
  });

  it('should propagate an HTTP error from generateContent', async (): Promise<void> => {
    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'OPENAI_API_URL') {
        return 'https://openai.test/responses';
      }
      return 'secret-key';
    });

    const error: Error = new Error('OpenAI HTTP error');
    jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      client.generateContent({ model: 'gpt-test', input: 'hello' }),
    ).rejects.toBe(error);
  });

  it('should propagate an HTTP error from generateEmbeddings', async (): Promise<void> => {
    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'OPENAI_EMBEDDING_URL') {
        return 'https://openai.test/embeddings';
      }
      return 'secret-key';
    });

    const error: Error = new Error('OpenAI embeddings HTTP error');
    jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      client.generateEmbeddings({ model: 'embedding-test', input: ['hello'] }),
    ).rejects.toBe(error);
  });
});

import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { GeminiClient } from './gemini.client';
import { GeminiChatRequest } from '../types/gemini/gemini-chat-request';
import { GeminiEmbedRequest } from '../types/gemini/gemini-embed-request';
import { GeminiChatResponse } from '../types/gemini/gemini-chat-response';
import { GeminiEmbedResponse } from '../types/gemini/gemini-embed-response';

describe('GeminiClient', (): void => {
  let client: GeminiClient;
  let configService: jest.Mocked<ConfigService>;

  beforeEach((): void => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    client = new GeminiClient(configService);
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should generate content and return the first candidate text', async (): Promise<void> => {
    const request: GeminiChatRequest = {
      contents: [
        {
          parts: [{ text: 'hello' }],
        },
      ],
    };
    const response: GeminiChatResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Gemini answer' }],
          },
        },
      ],
    };

    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'GEMINI_API_URL') {
        return 'https://gemini.test/generate?key=';
      }
      return 'secret-key';
    });

    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: response } as never);

    const result: string = await client.generateContent(request);

    expect(result).toBe('Gemini answer');
    expect(configService.getOrThrow).toHaveBeenCalledWith('GEMINI_API_URL');
    expect(configService.getOrThrow).toHaveBeenCalledWith('GEMINI_API_KEY');
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      'https://gemini.test/generate?key=secret-key',
      request,
    );
  });

  it('should generate an embedding and return its values', async (): Promise<void> => {
    const request: GeminiEmbedRequest = {
      content: {
        parts: [{ text: 'hello' }],
      },
      embedContentConfig: {
        output_dimensionality: 1536,
      },
    };
    const response: GeminiEmbedResponse = {
      embedding: {
        values: [0.1, 0.2, 0.3],
      },
    };

    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'GEMINI_EMBEDDING_URL') {
        return 'https://gemini.test/embed?key=';
      }
      return 'secret-key';
    });

    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: response } as never);

    const result: number[] = await client.generateEmbedding(request);

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      'https://gemini.test/embed?key=secret-key',
      request,
    );
  });

  it('should propagate an HTTP error from generateContent', async (): Promise<void> => {
    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'GEMINI_API_URL') {
        return 'https://gemini.test/generate?key=';
      }
      return 'secret-key';
    });

    const error: Error = new Error('Gemini HTTP error');
    jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      client.generateContent({ contents: [] }),
    ).rejects.toBe(error);
  });

  it('should propagate an HTTP error from generateEmbedding', async (): Promise<void> => {
    configService.getOrThrow.mockImplementation((key: string): string => {
      if (key === 'GEMINI_EMBEDDING_URL') {
        return 'https://gemini.test/embed?key=';
      }
      return 'secret-key';
    });

    const error: Error = new Error('Gemini embedding HTTP error');
    jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      client.generateEmbedding({
        content: { parts: [] },
        embedContentConfig: { output_dimensionality: 1536 },
      }),
    ).rejects.toBe(error);
  });
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiRequest } from '../types/openai/openai-request';
import { OpenAiResponse } from '../types/openai/openai-response';
import { OpenAiEmbeddingsResponse } from '../types/openai/openai-embeddings-response';
import { OpenAiEmbedding } from '../types/openai/openai-embedding';
import { postWithRetry } from './ai-client-retry';

/**
 * Адаптирует запросы к API OpenAI для генерации текста и эмбеддингов и преобразует ответы провайдера в типы приложения.
 *
 * Запрос повторяется при временных ошибках провайдера (лимит, перегрузка):
 * без повторов один 429 превращался в 500 на весь ответ.
 */
@Injectable()
export class OpenAiClient {
  constructor(private readonly configService: ConfigService) {}

  async generateContent(request: OpenAiRequest): Promise<string> {
    const url: string = this.configService.getOrThrow('OPENAI_API_URL');

    const response = await postWithRetry<OpenAiResponse>(
      url,
      request,
      { headers: this.headers() },
      'OpenAI generation',
    );

    return response.data.output[0].content[0].text;
  }

  async generateEmbeddings(request: OpenAiRequest): Promise<number[][]> {
    const url: string = this.configService.getOrThrow('OPENAI_EMBEDDING_URL');

    const response = await postWithRetry<OpenAiEmbeddingsResponse>(
      url,
      request,
      { headers: this.headers() },
      'OpenAI embedding',
    );

    return response.data.data.map(
      (e: OpenAiEmbedding): number[] => e.embedding,
    );
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.configService.getOrThrow('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    };
  }
}

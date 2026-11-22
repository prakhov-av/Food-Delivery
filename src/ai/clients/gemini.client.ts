import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiChatRequest } from '../types/gemini/gemini-chat-request';
import { GeminiChatResponse } from '../types/gemini/gemini-chat-response';
import { GeminiEmbedRequest } from '../types/gemini/gemini-embed-request';
import { GeminiEmbedResponse } from '../types/gemini/gemini-embed-response';
import { postWithRetry } from './ai-client-retry';

/**
 * Инкапсулирует запросы к Gemini: генерация текста и эмбеддинги.
 *
 * Запрос повторяется при временных ошибках провайдера (лимит, перегрузка):
 * без повторов один 429 от Gemini превращался в 500 на весь ответ.
 */
@Injectable()
export class GeminiClient {
  constructor(private readonly configService: ConfigService) {}

  async generateContent(
    request: GeminiChatRequest,
    classifierUrl?: string,
  ): Promise<string> {
    const baseUrl: string =
      classifierUrl?.trim() || this.configService.getOrThrow('GEMINI_API_URL');

    const key: string = this.configService.getOrThrow('GEMINI_API_KEY');
    const url: string = baseUrl + key;

    const response = await postWithRetry<GeminiChatResponse>(
      url,
      request,
      {},
      'Gemini generation',
    );

    return response.data.candidates[0].content.parts[0].text;
  }

  async generateEmbedding(request: GeminiEmbedRequest): Promise<number[]> {
    const baseUrl: string = this.configService.getOrThrow(
      'GEMINI_EMBEDDING_URL',
    );

    const key: string = this.configService.getOrThrow('GEMINI_API_KEY');
    const url: string = baseUrl + key;

    const response = await postWithRetry<GeminiEmbedResponse>(
      url,
      request,
      {},
      'Gemini embedding',
    );

    return response.data.embedding.values;
  }
}

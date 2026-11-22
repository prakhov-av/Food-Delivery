import { Injectable } from '@nestjs/common';
import { GeminiClient } from './clients/gemini.client';
import { GeminiPart } from './types/gemini/gemini-part';
import { GeminiContent } from './types/gemini/gemini-content';
import { GeminiChatRequest } from './types/gemini/gemini-chat-request';
import { GeminiEmbedRequest } from './types/gemini/gemini-embed-request';
import { GeminiEmbedContentConfig } from './types/gemini/gemini-embed-content-config';
import { OpenAiClient } from './clients/openai.client';
import { ConfigService } from '@nestjs/config';
import { OpenAiRequest } from './types/openai/openai-request';
import { ConfigurationException } from '../exceptions/types/configuration.exception';

/**
 * Предоставляет единый интерфейс генерации текстовых ответов и эмбеддингов, скрывая детали выбранного AI-провайдера.
 */
export interface GenerateOptions {
  classification?: boolean;
}
@Injectable()
export class AiService {
  /**
   * Счётчик вызовов генерации с момента последнего сброса.
   *
   * Нужен для eval-набора: главная метрика экономии — сколько вызовов LLM
   * уходит на один вопрос.
   */
  private callCount: number = 0;

  constructor(
    private readonly geminiClient: GeminiClient,
    private readonly openAiClient: OpenAiClient,
    private readonly configService: ConfigService,
  ) {}

  /** Количество вызовов генерации с момента последнего сброса. */
  getCallCount(): number {
    return this.callCount;
  }

  /** Сбрасывает счётчик вызовов. */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */

  async generateResponse(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    this.callCount += 1;

    const generationAiProvider: string = this.configService.getOrThrow(
      'PRIMARY_GENERATION_AI_PROVIDER',
      'gemini',
    );

    switch (generationAiProvider) {
      case 'gemini': {
        const part: GeminiPart = new GeminiPart();
        part.text = prompt;
        const content: GeminiContent = new GeminiContent();
        content.parts = [part];
        const request: GeminiChatRequest = new GeminiChatRequest();
        request.contents = [content];

        if (!options?.classification) {
          return this.geminiClient.generateContent(request);
        }

        // Классификатору нужен строгий JSON и короткий ответ.
        request.generationConfig = {
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        };

        const configured: string | undefined = this.configService.get(
          'GEMINI_CLASSIFIER_API_URL',
        );
        const trimmed: string | undefined = configured?.trim();
        const classifierUrl: string | undefined = trimmed ? trimmed : undefined;

        return classifierUrl === undefined
          ? this.geminiClient.generateContent(request)
          : this.geminiClient.generateContent(request, classifierUrl);
      }

      case 'openai': {
        const request: OpenAiRequest = new OpenAiRequest();

        // Классификатор отвечает коротким JSON и не нуждается в большой
        // модели: отдельная модель экономит время до ответа пользователя.
        request.model = options?.classification
          ? this.configService.get('OPENAI_CLASSIFIER_MODEL') ??
            this.configService.getOrThrow('OPENAI_MODEL')
          : this.configService.getOrThrow('OPENAI_MODEL');
        request.input = prompt;

        return this.openAiClient.generateContent(request);
      }

      default:
        throw new ConfigurationException(
          `${generationAiProvider} generation AI provider is not supported`,
        );
    }
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddingsAiProvider: string = this.configService.getOrThrow(
      'PRIMARY_EMBEDDINGS_AI_PROVIDER',
      'gemini',
    );

    switch (embeddingsAiProvider) {
      case 'gemini': {
        const parts: GeminiPart[] = this.convertTextsToParts(texts);
        const result: number[][] = [];

        for (const part of parts) {
          const content: GeminiContent = new GeminiContent();
          content.parts = [part];

          const request: GeminiEmbedRequest = new GeminiEmbedRequest();
          request.content = content;
          request.embedContentConfig = new GeminiEmbedContentConfig();

          const embedding: number[] =
            await this.geminiClient.generateEmbedding(request);
          result.push(embedding);
        }

        return result;
      }

      case 'openai': {
        const model: string = this.configService.getOrThrow(
          'OPENAI_EMBEDDING_MODEL',
        );

        const request: OpenAiRequest = new OpenAiRequest();
        request.model = model;
        request.input = texts;

        return this.openAiClient.generateEmbeddings(request);
      }

      default:
        throw new ConfigurationException(
          `${embeddingsAiProvider} embeddings AI provider is not supported`,
        );
    }
  }

  private convertTextsToParts(texts: string[]): GeminiPart[] {
    return texts.map((t: string): GeminiPart => {
      const part: GeminiPart = new GeminiPart();
      part.text = t;
      return part;
    });
  }
}

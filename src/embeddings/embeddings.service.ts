import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

/**
   * Предоставляет прикладному коду единый интерфейс генерации векторных представлений текста через настроенного AI-провайдера.
   */
@Injectable()
export class EmbeddingsService {
  constructor(private readonly aiService: AiService) {}
/**
   * Генерирует векторные представления переданных текстов через настроенный AI-сервис.
   * @param texts Тексты, для которых необходимо вычислить эмбеддинги.
   * @returns Массив векторов в том же порядке, что и входные тексты.
   */

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.aiService.generateEmbeddings(texts);
  }
}

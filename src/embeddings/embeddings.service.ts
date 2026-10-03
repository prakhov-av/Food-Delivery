import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class EmbeddingsService {
  constructor(private readonly aiService: AiService) {}

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.aiService.generateEmbeddings(texts);
  }
}

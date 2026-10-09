import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { AiModule } from '../ai/ai.module';

@Module({
  providers: [EmbeddingsService],
  imports: [AiModule],
  exports: [EmbeddingsService],
})
/**
   * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
   */
export class EmbeddingsModule {}

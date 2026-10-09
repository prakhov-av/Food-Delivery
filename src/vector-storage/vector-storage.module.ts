import { Module } from '@nestjs/common';
import { VectorStorageService } from './vector-storage.service';
import { QdrantClient } from './qdrant/qdrant-client';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  providers: [VectorStorageService, QdrantClient],
  imports: [EmbeddingsModule],
  exports: [VectorStorageService],
})
/**
   * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
   */
export class VectorStorageModule {}

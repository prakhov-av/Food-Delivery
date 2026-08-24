import { Module } from '@nestjs/common';
import { VectorStorageService } from './vector-storage.service';
import { QdrantClient } from './qdrant/qdrant-client';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  providers: [VectorStorageService, QdrantClient],
  imports: [EmbeddingsModule],
  exports: [VectorStorageService],
})
export class VectorStorageModule {}

import { Module } from '@nestjs/common';
import { VectorStorageController } from './vector-storage.controller';
import { VectorStorageService } from './vector-storage.service';
import { QdrantClient } from './qdrant/qdrant-client';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  controllers: [VectorStorageController],
  providers: [VectorStorageService, QdrantClient],
  imports: [EmbeddingsModule],
})
export class VectorStorageModule {}

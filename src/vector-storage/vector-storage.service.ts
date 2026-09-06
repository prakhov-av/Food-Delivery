import { Injectable } from '@nestjs/common';
import { QdrantPoint } from './qdrant/types/qdrant-point';
import { randomUUID } from 'node:crypto';
import { QdrantClient } from './qdrant/qdrant-client';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { QdrantResult } from './qdrant/types/qdrant-result';
import { Chunk } from '../ingestion/types/chunk';
import { Role } from '../users/enums/role.enum';
import { QdrantPayload } from './qdrant/types/qdrant-payload';
import { DocumentType } from '../ingestion/enums/document-type.enum';

@Injectable()
export class VectorStorageService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly client: QdrantClient,
  ) {}

  async saveToDb(payloads: Chunk[]): Promise<void> {
    const texts: string[] = payloads.map((p: Chunk): string => p.text);

    const embeddings: number[][] =
      await this.embeddingsService.generateEmbeddings(texts);

    const points: QdrantPoint[] = this.generatePoints(embeddings, payloads);

    await this.client.save(points);
  }

  private generatePoints(
    embeddings: number[][],
    payloads: Chunk[],
  ): QdrantPoint[] {
    const result: QdrantPoint[] = [];

    for (let i: number = 0; i < embeddings.length; i++) {
      const point: QdrantPoint = new QdrantPoint();
      point.id = randomUUID();
      point.vector = embeddings[i];
      point.payload = this.createQdrantPayload(payloads[i]);
      result.push(point);
    }

    return result;
  }

  private createQdrantPayload(chunk: Chunk): QdrantPayload {
    const payload: QdrantPayload = new QdrantPayload();
    payload.text = chunk.text;
    payload.docTitle = chunk.docTitle;
    payload.page = chunk.page;
    payload.documentType = chunk.documentType;
    payload.allowedRoles = chunk.allowedRoles;
    payload.language = chunk.language;
    return payload;
  }

  async getRelevantChunkByAccess(
    embedding: number[],
    documentType: DocumentType,
    userRole: Role,
  ): Promise<string[]> {
    const relevantChunks: QdrantResult[] =
      await this.client.getRelevantChunksByAccess(
        embedding,
        documentType,
        userRole,
      );

    return relevantChunks.map((c: QdrantResult): string => c.payload.text);
  }
}

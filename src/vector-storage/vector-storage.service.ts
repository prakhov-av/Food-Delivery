import { Injectable } from '@nestjs/common';
import { QdrantPoint } from './qdrant/types/search/qdrant-point';
import { randomUUID } from 'node:crypto';
import { QdrantClient } from './qdrant/qdrant-client';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { QdrantResult } from './qdrant/types/search/qdrant-result';
import { Chunk } from '../ingestion/types/chunk';
import { Role } from '../users/enums/role.enum';
import { QdrantPayload } from './qdrant/types/search/qdrant-payload';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { DocumentVersionConflictException } from '../exceptions/types/document-version-conflict.exception';

@Injectable()
export class VectorStorageService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly client: QdrantClient,
  ) {}

  async saveToDb(
    payloads: Chunk[],
    documentId: string,
    documentVersion: number,
  ): Promise<void> {
    const texts: string[] = payloads.map((p: Chunk): string => p.text);

    const embeddings: number[][] =
      await this.embeddingsService.generateEmbeddings(texts);

    const points: QdrantPoint[] = this.generatePoints(embeddings, payloads);

    await this.archiveOldDocumentVersion(documentId, documentVersion);

    await this.client.save(points);
  }

  private async archiveOldDocumentVersion(
    documentId: string,
    documentVersion: number,
  ): Promise<void> {
    const points: QdrantPoint[] =
      await this.client.findPointsByDocumentId(documentId);

    if (points.length === 0) {
      return;
    }

    const oldVersion: number = points[0].payload.documentVersion;

    if (documentVersion <= oldVersion) {
      throw new DocumentVersionConflictException(oldVersion, documentVersion);
    }

    await this.client.save(points, true);
    await this.client.deletePointsByDocumentId(documentId);
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
    payload.documentVersion = chunk.documentVersion;
    payload.documentId = chunk.documentId;
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

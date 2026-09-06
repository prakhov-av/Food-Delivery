import { Injectable } from '@nestjs/common';
import { QdrantPoint } from './types/qdrant-point';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { QdrantResult } from './types/qdrant-result';
import { SearchFilterMatcher } from './types/filters/search-filter-matcher';
import { SearchFilterParameter } from './types/filters/search-filter-parameter';
import { QdrantResponse } from './types/qdrant-response';
import { SearchFilterAnd } from './types/filters/search-filter-and';
import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../../ingestion/enums/document-type.enum';

@Injectable()
export class QdrantClient {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const dbUrl: string = this.configService.getOrThrow('QDRANT_URL');
    const collectionName: string = this.configService.getOrThrow(
      'KNOWLEDGE_DB_COLLECTION_NAME',
    );
    this.baseUrl = `${dbUrl}/collections/${collectionName}`;
  }

  async save(points: QdrantPoint[]): Promise<void> {
    try {
      await axios.put(this.baseUrl, {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      });
    } catch {
      // Collection already exists
    }

    await axios.put(`${this.baseUrl}/points`, {
      points: points,
    });
  }

  async getRelevantChunksByAccess(
    embedding: number[],
    documentType: DocumentType,
    userRole: Role,
  ): Promise<QdrantResult[]> {
    const response: QdrantResponse = await axios.post(
      `${this.baseUrl}/points/search`,
      {
        vector: embedding,
        limit: 5,
        with_payload: true,
        with_vector: false,
        filter: this.createMetadataSearchFilter(documentType, userRole),
      },
    );

    return response.data.result;
  }

  private createMetadataSearchFilter(
    documentType: DocumentType,
    userRole: Role,
  ): SearchFilterAnd {
    const filter: SearchFilterAnd = new SearchFilterAnd();

    const documentTypeMatcher: SearchFilterMatcher =
      new SearchFilterMatcher();
    documentTypeMatcher.value = documentType;

    const documentTypeParameter: SearchFilterParameter =
      new SearchFilterParameter();
    documentTypeParameter.key = 'documentType';
    documentTypeParameter.match = documentTypeMatcher;

    const roleMatcher: SearchFilterMatcher = new SearchFilterMatcher();
    roleMatcher.any = [userRole];

    const roleParameter: SearchFilterParameter = new SearchFilterParameter();
    roleParameter.key = 'allowedRoles';
    roleParameter.match = roleMatcher;

    filter.must.push(documentTypeParameter, roleParameter);

    return filter;
  }
}

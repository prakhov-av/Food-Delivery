import { Injectable } from '@nestjs/common';
import { QdrantPoint } from './types/search/qdrant-point';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { QdrantResult } from './types/search/qdrant-result';
import { SearchFilterMatcher } from './types/filters/search-filter-matcher';
import { SearchFilterParameter } from './types/filters/search-filter-parameter';
import { QdrantResponse } from './types/search/qdrant-response';
import { SearchFilterAnd } from './types/filters/search-filter-and';
import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../../ingestion/enums/document-type.enum';
import { QdrantScrollResponse } from './types/scroll/qdrant-scroll-response';

@Injectable()
export class QdrantClient {
  private readonly baseUrl: string;
  private readonly archiveUrl: string;

  constructor(private readonly configService: ConfigService) {
    const dbUrl: string = this.configService.getOrThrow('QDRANT_URL');
    const collectionName: string = this.configService.getOrThrow(
      'KNOWLEDGE_DB_COLLECTION_NAME',
    );
    this.baseUrl = `${dbUrl}/collections/${collectionName}`;

    const archiveCollectionName: string = this.configService.getOrThrow(
      'ARCHIVE_DB_COLLECTION_NAME',
    );
    this.archiveUrl = `${dbUrl}/collections/${archiveCollectionName}`;
  }

  async onModuleInit(): Promise<void> {
    for (const url of [this.baseUrl, this.archiveUrl]) {
      try {
        await axios.put(url, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        });
      } catch {
        // Collection already exists
      }
    }
  }

  async save(points: QdrantPoint[], toArchive?: boolean): Promise<void> {
    const url: string = toArchive ? this.archiveUrl : this.baseUrl;

    await axios.put(`${url}/points`, {
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

    const documentTypeMatcher: SearchFilterMatcher = new SearchFilterMatcher();
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

  async findPointsByDocumentId(documentId: string): Promise<QdrantPoint[]> {
    const points: QdrantPoint[] = [];
    let offset: string | null = null;

    do {
      const response: QdrantScrollResponse = await axios.post(
        `${this.baseUrl}/points/scroll`,
        {
          with_payload: true,
          with_vector: true,
          filter: this.createScrollFilter(documentId),
          offset: offset,
        },
      );

      points.push(...response.data.result.points);
      offset = response.data.result.next_page_offset;
    } while (offset !== null);

    return points;
  }

  private createScrollFilter(documentId: string): SearchFilterAnd {
    const matcher: SearchFilterMatcher = new SearchFilterMatcher();
    matcher.value = documentId;

    const parameter: SearchFilterParameter = new SearchFilterParameter();
    parameter.key = 'documentId';
    parameter.match = matcher;

    const filter: SearchFilterAnd = new SearchFilterAnd();
    filter.must = [parameter];

    return filter;
  }

  async deletePointsByDocumentId(documentId: string): Promise<void> {
    const filter: SearchFilterAnd = this.createScrollFilter(documentId);

    await axios.post(`${this.baseUrl}/points/delete`, { filter: filter });
  }
}

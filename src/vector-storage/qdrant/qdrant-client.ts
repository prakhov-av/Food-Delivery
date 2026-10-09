import { Injectable } from '@nestjs/common';
import { QdrantPoint } from './types/search/qdrant-point';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { QdrantResult } from './types/search/qdrant-result';
import { SearchFilterMatcher } from './types/filters/search-filter-matcher';
import { SearchFilterParameter } from './types/filters/search-filter-parameter';
import { QdrantResponse } from './types/search/qdrant-response';
import { SearchFilterAnd } from './types/filters/search-filter-and';
import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../../ingestion/enums/document-type.enum';
import { QdrantScrollResponse } from './types/scroll/qdrant-scroll-response';
import { ConfigurationException } from '../../exceptions/types/configuration.exception';

/**
   * Инкапсулирует HTTP-взаимодействие с Qdrant: сохранение, поиск, чтение и удаление точек векторной коллекции.
   */
@Injectable()
export class QdrantClient {
  private readonly baseUrl: string;
  private readonly archiveUrl: string;

  // Заголовок api-key добавляется только если задан QDRANT_API_KEY.
  // Без ключа запросы уходят как раньше (локальный Qdrant без защиты).
  private readonly requestConfig?: AxiosRequestConfig;

  constructor(private readonly configService: ConfigService) {
    const dbUrl: string = this.normalizeUrl(
      this.configService.getOrThrow('QDRANT_URL'),
    );
    const collectionName: string = this.configService.getOrThrow(
      'KNOWLEDGE_DB_COLLECTION_NAME',
    );
    this.baseUrl = `${dbUrl}/collections/${collectionName}`;

    const archiveCollectionName: string = this.configService.getOrThrow(
      'ARCHIVE_DB_COLLECTION_NAME',
    );
    this.archiveUrl = `${dbUrl}/collections/${archiveCollectionName}`;

    const apiKey: string | undefined = this.configService
      .get<string>('QDRANT_API_KEY')
      ?.trim();

    if (apiKey) {
      this.requestConfig = { headers: { 'api-key': apiKey } };
    }
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async onModuleInit(): Promise<void> {
    for (const url of [this.baseUrl, this.archiveUrl]) {
      try {
        await this.put(url, {
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

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(points: QdrantPoint[], toArchive?: boolean): Promise<void> {
    const url: string = toArchive ? this.archiveUrl : this.baseUrl;

    await this.put(`${url}/points`, {
      points: points,
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getRelevantChunksByAccess(
    embedding: number[],
    documentType: DocumentType | undefined,
    userRole: Role,
  ): Promise<QdrantResult[]> {
    const response: QdrantResponse = await this.post(
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

  // Роль всегда обязательна (это контроль доступа). Тип документа необязателен:
  // без него поиск идёт по всем документам, доступным роли.
  private createMetadataSearchFilter(
    documentType: DocumentType | undefined,
    userRole: Role,
  ): SearchFilterAnd {
    const filter: SearchFilterAnd = new SearchFilterAnd();

    if (documentType) {
      const documentTypeMatcher: SearchFilterMatcher =
        new SearchFilterMatcher();
      documentTypeMatcher.value = documentType;

      const documentTypeParameter: SearchFilterParameter =
        new SearchFilterParameter();
      documentTypeParameter.key = 'documentType';
      documentTypeParameter.match = documentTypeMatcher;

      filter.must.push(documentTypeParameter);
    }

    const roleMatcher: SearchFilterMatcher = new SearchFilterMatcher();
    roleMatcher.any = [userRole];

    const roleParameter: SearchFilterParameter = new SearchFilterParameter();
    roleParameter.key = 'allowedRoles';
    roleParameter.match = roleMatcher;

    filter.must.push(roleParameter);

    return filter;
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findPointsByDocumentId(documentId: string): Promise<QdrantPoint[]> {
    const points: QdrantPoint[] = [];
    let offset: string | null = null;

    do {
      const response: QdrantScrollResponse = await this.post(
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

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deletePointsByDocumentId(documentId: string): Promise<void> {
    const filter: SearchFilterAnd = this.createScrollFilter(documentId);

    await this.post(`${this.baseUrl}/points/delete`, { filter: filter });
  }

  // Единая точка для всех HTTP-вызовов: так api-key не пропустит ни один метод.
  // Без ключа третий аргумент не передаётся вовсе.
  private put(url: string, body: unknown): Promise<AxiosResponse> {
    return this.requestConfig
      ? axios.put(url, body, this.requestConfig)
      : axios.put(url, body);
  }

  private post(url: string, body: unknown): Promise<AxiosResponse> {
    return this.requestConfig
      ? axios.post(url, body, this.requestConfig)
      : axios.post(url, body);
  }

  // QDRANT_URL принимает ровно один адрес (без запятых и без /dashboard).
  private normalizeUrl(value: string): string {
    const trimmed: string = value.trim().replace(/\/+$/, '');

    if (!this.isValidUrl(trimmed)) {
      throw new ConfigurationException(
        `QDRANT_URL must be a single valid URL, got: ${value}`,
      );
    }

    return trimmed;
  }

  private isValidUrl(value: string): boolean {
    try {
      return Boolean(new URL(value));
    } catch {
      return false;
    }
  }
}

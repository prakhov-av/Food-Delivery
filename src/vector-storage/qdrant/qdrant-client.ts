import { Injectable, Logger } from '@nestjs/common';
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
import { Lang } from '../../chat/locales/lang';

/**
 * Размерность вектора коллекции по умолчанию.
 *
 * Значение не должно быть зашито в коде: у другой модели эмбеддингов
 * размерность другая (у text-embedding-004 по умолчанию 768), и новая
 * среда создаст коллекцию, в которую ничего не запишется.
 */
const DEFAULT_VECTOR_SIZE = 1536;

/** Таймаут одного запроса к Qdrant по умолчанию, мс. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
   * Инкапсулирует HTTP-взаимодействие с Qdrant: сохранение, поиск, чтение и удаление точек векторной коллекции.
   */
@Injectable()
export class QdrantClient {
  private readonly logger: Logger = new Logger(QdrantClient.name);

  private readonly baseUrl: string;
  private readonly archiveUrl: string;

  /** Поля, для которых создаётся keyword-индекс. */
  private readonly keywordIndexFields: string[] = ['language'];

  /** Размерность вектора коллекции. */
  private readonly vectorSize: number;

  /** Таймаут одного запроса к Qdrant, мс. */
  private readonly requestTimeoutMs: number;

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

    const configuredSize: number = Number(
      this.configService.get('QDRANT_VECTOR_SIZE') ?? DEFAULT_VECTOR_SIZE,
    );

    this.vectorSize =
      Number.isInteger(configuredSize) && configuredSize > 0
        ? configuredSize
        : DEFAULT_VECTOR_SIZE;

    const configuredTimeout: number = Number(
      this.configService.get('QDRANT_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS,
    );

    this.requestTimeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async onModuleInit(): Promise<void> {
    for (const url of [this.baseUrl, this.archiveUrl]) {
      try {
        await this.put(url, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
      } catch (error) {
        // Коллекция уже есть (409) — это нормальное состояние.
        // Любая другая ошибка (неверный ключ, недоступный Qdrant) должна
        // быть видна: молчаливый catch прятал её до первого чата.
        if (this.isConflict(error)) {
          continue;
        }

        this.logger.error(
          `Failed to create Qdrant collection ${url}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Индексы создаются только по явному запросу: коллекция живёт в общей
    // базе, и её схему нельзя менять молча при старте приложения.
    if (this.shouldCreatePayloadIndexes()) {
      await this.createPayloadIndexes();
    }
  }

  /** Статус ответа: 409 означает «уже существует». */
  private isConflict(error: unknown): boolean {
    const status: unknown = (error as { response?: { status?: number } })
      ?.response?.status;

    return status === 409;
  }

  /**
   * Создаёт keyword-индексы для полей фильтрации.
   *
   * Фильтр по language работает и без индекса, но с индексом Qdrant
   * отбирает точки заметно быстрее на больших коллекциях.
   */
  async createPayloadIndexes(): Promise<void> {
    for (const field of this.keywordIndexFields) {
      try {
        await this.put(`${this.baseUrl}/index`, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch {
        // Индекс уже существует или Qdrant не даёт его создать: поиск
        // продолжает работать, просто медленнее.
      }
    }
  }

  private shouldCreatePayloadIndexes(): boolean {
    return (
      String(this.configService.get('QDRANT_CREATE_PAYLOAD_INDEXES') ?? '')
        .trim()
        .toLowerCase() === 'true'
    );
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
    lang?: Lang,
  ): Promise<QdrantResult[]> {
    const response: QdrantResponse = await this.post(
      `${this.baseUrl}/points/search`,
      {
        vector: embedding,
        limit: 5,
        with_payload: true,
        with_vector: false,
        filter: this.createMetadataSearchFilter(documentType, userRole, lang),
      },
    );

    return response.data.result;
  }

  // Роль всегда обязательна (это контроль доступа). Тип документа необязателен:
  // без него поиск идёт по всем документам, доступным роли. Язык необязателен:
  // без него поиск идёт по всем языкам, но медленнее.
  private createMetadataSearchFilter(
    documentType: DocumentType | undefined,
    userRole: Role,
    lang?: Lang,
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

    if (lang) {
      const langMatcher: SearchFilterMatcher = new SearchFilterMatcher();
      langMatcher.value = lang;

      const langParameter: SearchFilterParameter = new SearchFilterParameter();
      langParameter.key = 'language';
      langParameter.match = langMatcher;

      filter.must.push(langParameter);
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
  //
  // У каждого запроса есть таймаут: зависший Qdrant больше не держит
  // соединение и не съедает все попытки поиска подряд.
  private put(url: string, body: unknown): Promise<AxiosResponse> {
    return this.requestWithRetry('put', url, body);
  }

  private post(url: string, body: unknown): Promise<AxiosResponse> {
    return this.requestWithRetry('post', url, body);
  }

  /**
   * HTTP-вызов с таймаутом и одной повторной попыткой на 5xx.
   *
   * Таймаут обязателен: зависший Qdrant иначе держит соединение, а поиск
   * делает до четырёх попыток подряд. Повтор делается только на ошибке
   * сервера: сетевой сбой и таймаут повторять бессмысленно.
   */
  private async requestWithRetry(
    method: 'put' | 'post',
    url: string,
    body: unknown,
  ): Promise<AxiosResponse> {
    const config: AxiosRequestConfig = {
      ...(this.requestConfig ?? {}),
      timeout: this.requestTimeoutMs,
    };

    try {
      return await axios[method](url, body, config);
    } catch (error) {
      if (!this.isServerError(error)) {
        throw error;
      }

      this.logger.warn(
        `Qdrant ${method} ${url} failed with a server error, retrying once`,
      );

      return axios[method](url, body, config);
    }
  }

  /** Ответ сервера с кодом 5xx: такой запрос имеет смысл повторить. */
  private isServerError(error: unknown): boolean {
    const status: unknown = (error as { response?: { status?: number } })
      ?.response?.status;

    return typeof status === 'number' && status >= 500 && status < 600;
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

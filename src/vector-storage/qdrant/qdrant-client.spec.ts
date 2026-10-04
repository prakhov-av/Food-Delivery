import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from './qdrant-client';
import { QdrantPoint } from './types/search/qdrant-point';
import { QdrantResponse } from './types/search/qdrant-response';
import { QdrantScrollResponse } from './types/scroll/qdrant-scroll-response';
import { DocumentType } from '../../ingestion/enums/document-type.enum';
import { Role } from '../../users/enums/role.enum';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('QdrantClient', (): void => {
  let client: QdrantClient;
  let configService: jest.Mocked<ConfigService>;

  beforeEach((): void => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn((key: string): string => {
        const values: Record<string, string> = {
          QDRANT_URL: 'http://qdrant:6333',
          KNOWLEDGE_DB_COLLECTION_NAME: 'food_delivery',
          ARCHIVE_DB_COLLECTION_NAME: 'food_delivery_archive',
        };

        return values[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    client = new QdrantClient(configService);
  });

  it('should build collection URLs from configuration', async (): Promise<void> => {
    mockedAxios.put.mockResolvedValue({} as never);

    await client.onModuleInit();

    expect(configService.getOrThrow).toHaveBeenCalledWith('QDRANT_URL');
    expect(configService.getOrThrow).toHaveBeenCalledWith(
      'KNOWLEDGE_DB_COLLECTION_NAME',
    );
    expect(configService.getOrThrow).toHaveBeenCalledWith(
      'ARCHIVE_DB_COLLECTION_NAME',
    );
    expect(mockedAxios.put).toHaveBeenNthCalledWith(
      1,
      'http://qdrant:6333/collections/food_delivery',
      {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      },
    );
    expect(mockedAxios.put).toHaveBeenNthCalledWith(
      2,
      'http://qdrant:6333/collections/food_delivery_archive',
      {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      },
    );
  });

  it('should ignore collection creation errors during module initialization', async (): Promise<void> => {
    mockedAxios.put.mockRejectedValue(new Error('collection already exists'));

    await expect(client.onModuleInit()).resolves.toBeUndefined();

    expect(mockedAxios.put).toHaveBeenCalledTimes(2);
  });

  it('should save points to the active collection by default', async (): Promise<void> => {
    const points = [{ id: 'point-1' }] as unknown as QdrantPoint[];
    mockedAxios.put.mockResolvedValue({} as never);

    await client.save(points);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/food_delivery/points',
      { points },
    );
  });

  it('should save points to the archive collection when requested', async (): Promise<void> => {
    const points = [{ id: 'point-1' }] as unknown as QdrantPoint[];
    mockedAxios.put.mockResolvedValue({} as never);

    await client.save(points, true);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/food_delivery_archive/points',
      { points },
    );
  });

  it('should search relevant chunks using document type and role filters', async (): Promise<void> => {
    const response = {
      data: {
        result: [{ id: 'point-1', score: 0.91 }],
      },
    } as unknown as QdrantResponse;
    mockedAxios.post.mockResolvedValue(response as never);

    const result = await client.getRelevantChunksByAccess(
      [0.1, 0.2],
      DocumentType.ORDER,
      Role.CUSTOMER,
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/food_delivery/points/search',
      {
        vector: [0.1, 0.2],
        limit: 5,
        with_payload: true,
        with_vector: false,
        filter: {
          must: [
            {
              key: 'documentType',
              match: { value: DocumentType.ORDER },
            },
            {
              key: 'allowedRoles',
              match: { any: [Role.CUSTOMER] },
            },
          ],
        },
      },
    );
    expect(result).toBe(response.data.result);
  });

  it('should return points from a single scroll page', async (): Promise<void> => {
    const response = {
      data: {
        result: {
          points: [{ id: 'point-1' }],
          next_page_offset: null,
        },
      },
    } as unknown as QdrantScrollResponse;
    mockedAxios.post.mockResolvedValue(response as never);

    const result = await client.findPointsByDocumentId('document-123');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/food_delivery/points/scroll',
      {
        with_payload: true,
        with_vector: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: 'document-123' },
            },
          ],
        },
        offset: null,
      },
    );
    expect(result).toEqual([{ id: 'point-1' }]);
  });

  it('should load all scroll pages until next_page_offset is null', async (): Promise<void> => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          result: {
            points: [{ id: 'point-1' }],
            next_page_offset: 'offset-1',
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          result: {
            points: [{ id: 'point-2' }],
            next_page_offset: null,
          },
        },
      } as never);

    const result = await client.findPointsByDocumentId('document-123');

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'http://qdrant:6333/collections/food_delivery/points/scroll',
      expect.objectContaining({ offset: null }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'http://qdrant:6333/collections/food_delivery/points/scroll',
      expect.objectContaining({ offset: 'offset-1' }),
    );
    expect(result).toEqual([{ id: 'point-1' }, { id: 'point-2' }]);
  });

  it('should delete points by document id', async (): Promise<void> => {
    mockedAxios.post.mockResolvedValue({} as never);

    await client.deletePointsByDocumentId('document-123');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/food_delivery/points/delete',
      {
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: 'document-123' },
            },
          ],
        },
      },
    );
  });

  it('should propagate Qdrant HTTP errors from save', async (): Promise<void> => {
    mockedAxios.put.mockRejectedValue(new Error('Qdrant unavailable'));

    await expect(client.save([])).rejects.toThrow('Qdrant unavailable');
  });

  it('should propagate Qdrant HTTP errors from search', async (): Promise<void> => {
    mockedAxios.post.mockRejectedValue(new Error('search failed'));

    await expect(
      client.getRelevantChunksByAccess(
        [0.1],
        DocumentType.ORDER,
        Role.CUSTOMER,
      ),
    ).rejects.toThrow('search failed');
  });

  it('should propagate Qdrant HTTP errors from scroll', async (): Promise<void> => {
    mockedAxios.post.mockRejectedValue(new Error('scroll failed'));

    await expect(client.findPointsByDocumentId('document-123')).rejects.toThrow(
      'scroll failed',
    );
  });

  it('should propagate Qdrant HTTP errors from delete', async (): Promise<void> => {
    mockedAxios.post.mockRejectedValue(new Error('delete failed'));

    await expect(
      client.deletePointsByDocumentId('document-123'),
    ).rejects.toThrow('delete failed');
  });
});

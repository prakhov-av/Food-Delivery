import { VectorStorageService } from './vector-storage.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { QdrantClient } from './qdrant/qdrant-client';
import { Chunk } from '../ingestion/types/chunk';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { Role } from '../users/enums/role.enum';
import { QdrantPoint } from './qdrant/types/search/qdrant-point';
import { QdrantResult } from './qdrant/types/search/qdrant-result';
import { DocumentVersionConflictException } from '../exceptions/types/document-version-conflict.exception';

describe('VectorStorageService', (): void => {
  let service: VectorStorageService;
  let embeddingsService: jest.Mocked<EmbeddingsService>;
  let client: jest.Mocked<QdrantClient>;

  const chunks: Chunk[] = [
    {
      docTitle: 'orders.md',
      page: 1,
      text: 'First chunk',
      documentType: DocumentType.ORDER,
      allowedRoles: [Role.CUSTOMER, Role.COURIER],
      language: 'ru',
      documentVersion: 2,
      documentId: 'document-123',
      index: 0,
    },
    {
      docTitle: 'orders.md',
      page: 2,
      text: 'Second chunk',
      documentType: DocumentType.ORDER,
      allowedRoles: [Role.CUSTOMER, Role.COURIER],
      language: 'ru',
      documentVersion: 2,
      documentId: 'document-123',
      index: 1,
    },
  ];

  beforeEach((): void => {
    embeddingsService = {
      generateEmbeddings: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingsService>;

    client = {
      save: jest.fn(),
      findPointsByDocumentId: jest.fn(),
      deletePointsByDocumentId: jest.fn(),
      getRelevantChunksByAccess: jest.fn(),
    } as unknown as jest.Mocked<QdrantClient>;

    service = new VectorStorageService(embeddingsService, client);
  });

  it('should generate embeddings and save points for a new document version', async (): Promise<void> => {
    embeddingsService.generateEmbeddings.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    client.findPointsByDocumentId.mockResolvedValue([]);

    await service.saveToDb(chunks, 'document-123', 2);

    expect(embeddingsService.generateEmbeddings).toHaveBeenCalledWith([
      'First chunk',
      'Second chunk',
    ]);
    expect(client.findPointsByDocumentId).toHaveBeenCalledWith('document-123');
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(client.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          vector: [0.1, 0.2],
          payload: expect.objectContaining(chunks[0]),
        }),
        expect.objectContaining({
          vector: [0.3, 0.4],
          payload: expect.objectContaining(chunks[1]),
        }),
      ]),
    );
    expect(client.deletePointsByDocumentId).not.toHaveBeenCalled();
  });

  it('should archive the previous version and delete its active points', async (): Promise<void> => {
    embeddingsService.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    client.findPointsByDocumentId.mockResolvedValue([
      {
        id: 'old-point',
        vector: [0.9, 0.8],
        payload: {
          ...chunks[0],
          documentVersion: 1,
        },
      } as QdrantPoint,
    ]);

    await service.saveToDb(chunks.slice(0, 1), 'document-123', 2);

    expect(client.save).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ id: 'old-point' }),
    ], true);
    expect(client.deletePointsByDocumentId).toHaveBeenCalledWith('document-123');
    expect(client.save).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          vector: [0.1, 0.2],
          payload: expect.objectContaining({
            documentId: 'document-123',
            documentVersion: 2,
          }),
        }),
      ],
    );
  });

  it('should throw when attempting to save an older document version', async (): Promise<void> => {
    embeddingsService.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    client.findPointsByDocumentId.mockResolvedValue([
      {
        id: 'old-point',
        vector: [0.9, 0.8],
        payload: {
          ...chunks[0],
          documentVersion: 3,
        },
      } as QdrantPoint,
    ]);

    await expect(
      service.saveToDb(chunks.slice(0, 1), 'document-123', 2),
    ).rejects.toBeInstanceOf(DocumentVersionConflictException);

    expect(client.save).not.toHaveBeenCalled();
    expect(client.deletePointsByDocumentId).not.toHaveBeenCalled();
  });

  it('should throw when attempting to save the same document version', async (): Promise<void> => {
    embeddingsService.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    client.findPointsByDocumentId.mockResolvedValue([
      {
        id: 'old-point',
        vector: [0.9, 0.8],
        payload: {
          ...chunks[0],
          documentVersion: 2,
        },
      } as QdrantPoint,
    ]);

    await expect(
      service.saveToDb(chunks.slice(0, 1), 'document-123', 2),
    ).rejects.toBeInstanceOf(DocumentVersionConflictException);
  });

  it('should propagate embedding errors and not access Qdrant', async (): Promise<void> => {
    const error = new Error('embedding failed');
    embeddingsService.generateEmbeddings.mockRejectedValue(error);

    await expect(
      service.saveToDb(chunks, 'document-123', 2),
    ).rejects.toThrow('embedding failed');

    expect(client.findPointsByDocumentId).not.toHaveBeenCalled();
    expect(client.save).not.toHaveBeenCalled();
  });

  it('should propagate Qdrant errors while finding old document points', async (): Promise<void> => {
    embeddingsService.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    client.findPointsByDocumentId.mockRejectedValue(new Error('qdrant failed'));

    await expect(
      service.saveToDb(chunks.slice(0, 1), 'document-123', 2),
    ).rejects.toThrow('qdrant failed');

    expect(client.save).not.toHaveBeenCalled();
  });

  it('should return relevant chunks from Qdrant', async (): Promise<void> => {
    const results: QdrantResult[] = [
      {
        id: 'point-1',
        version: 1,
        score: 0.95,
        payload: {
          text: 'order rules',
          docTitle: 'orders.md',
          page: 1,
          documentType: DocumentType.ORDER,
          allowedRoles: [Role.CUSTOMER],
          language: 'ru',
          documentVersion: 1,
          documentId: 'document-123',
          index: 0,
        },
      },
    ];
    client.getRelevantChunksByAccess.mockResolvedValue(results);

    const result = await service.getRelevantChunkByAccess(
      [0.1, 0.2],
      DocumentType.ORDER,
      Role.CUSTOMER,
    );

    expect(client.getRelevantChunksByAccess).toHaveBeenCalledWith(
      [0.1, 0.2],
      DocumentType.ORDER,
      Role.CUSTOMER,
    );
    expect(result).toBe(results);
  });
});

import { ConfigService } from '@nestjs/config';
import { ChunkingService } from './chunking.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { DocumentType } from './enums/document-type.enum';
import { Role } from '../users/enums/role.enum';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { Chunk } from './types/chunk';

describe('ChunkingService', (): void => {
  const createDto = (): IngestDocumentDto => ({
    documentType: DocumentType.ORDER,
    allowedRoles: [Role.CUSTOMER, Role.COURIER],
    language: 'ru',
    documentVersion: 2,
    documentId: 'document-123',
  });

  const createService = (
    chunkSize: string | number = 3,
    overlap: string | number = 1,
  ): ChunkingService => {
    const configService: ConfigService = {
      getOrThrow: jest.fn((key: string): string | number => {
        if (key === 'CHUNK_SIZE') {
          return chunkSize;
        }
        if (key === 'CHUNK_OVERLAP') {
          return overlap;
        }
        throw new Error(`Unexpected key: ${key}`);
      }),
    } as unknown as ConfigService;

    return new ChunkingService(configService);
  };

  it('should split text by sentence boundaries', (): void => {
    const service: ChunkingService = createService();

    expect(service.chunkBySentences('First sentence. Second sentence! Third?')).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third?',
    ]);
  });

  it('should split text by paragraphs', (): void => {
    const service: ChunkingService = createService();

    expect(service.chunkByParagraph('First\n\nSecond\r\n\r\nThird')).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('should split text by configured size', (): void => {
    const service: ChunkingService = createService(3);

    expect(service.chunkBySize('one two three four five')).toEqual([
      'one two three',
      'four five',
    ]);
  });

  it('should create chunks with overlap and preserve metadata', (): void => {
    const service: ChunkingService = createService(3, 1);
    const dto: IngestDocumentDto = createDto();

    const result: Chunk[] = service.chunkBySizeWithOverlap(
      ['one two three four five'],
      'orders.md',
      dto,
    );

    expect(result).toHaveLength(3);
    expect(result.map((chunk: Chunk): string => chunk.text)).toEqual([
      'one two three',
      'three four five',
      'five',
    ]);

    expect(result[0]).toMatchObject({
      docTitle: 'orders.md',
      page: 1,
      documentType: DocumentType.ORDER,
      allowedRoles: [Role.CUSTOMER, Role.COURIER],
      language: 'ru',
      documentVersion: 2,
      documentId: 'document-123',
      index: 0,
    });

    expect(result[1]).toMatchObject({
      page: 1,
      index: 1,
      documentId: 'document-123',
    });
  });

  it('should skip empty pages when creating chunks', (): void => {
    const service: ChunkingService = createService(2, 1);

    const result: Chunk[] = service.chunkBySizeWithOverlap(
      ['', 'one two', '   ', 'three'],
      'orders.md',
      createDto(),
    );

    expect(result.map((chunk: Chunk): string => chunk.text)).toEqual([
      'one two',
      'two',
      'three',
    ]);
    expect(result.map((chunk: Chunk): number => chunk.page)).toEqual([2, 2, 4]);
  });

  it('should reject an invalid chunk size', (): void => {
    const service: ChunkingService = createService(0, 1);

    expect(() => service.chunkBySize('one two')).toThrow(ConfigurationException);
  });

  it('should reject a non-numeric chunk size', (): void => {
    const service: ChunkingService = createService('invalid', 1);

    expect(() => service.chunkBySize('one two')).toThrow(ConfigurationException);
  });

  it('should reject an invalid overlap', (): void => {
    const service: ChunkingService = createService(3, 0);

    expect(() =>
      service.chunkBySizeWithOverlap(['one two three'], 'orders.md', createDto()),
    ).toThrow(ConfigurationException);
  });

  it('should reject an overlap equal to chunk size', (): void => {
    const service: ChunkingService = createService(3, 3);

    expect(() =>
      service.chunkBySizeWithOverlap(['one two three'], 'orders.md', createDto()),
    ).toThrow(ConfigurationException);
  });
});

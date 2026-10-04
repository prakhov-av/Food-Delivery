import { ConfigService } from '@nestjs/config';
import { ContextService } from './context.service';
import { QdrantResult } from '../vector-storage/qdrant/types/search/qdrant-result';
import { QdrantPayload } from '../vector-storage/qdrant/types/search/qdrant-payload';

describe('ContextService', () => {
  let service: ContextService;
  let configService: jest.Mocked<ConfigService>;

  const createChunk = (
    documentId: string,
    index: number,
    text: string,
    score: number,
  ): QdrantResult => {
    const payload = new QdrantPayload();
    payload.documentId = documentId;
    payload.index = index;
    payload.text = text;

    const result = new QdrantResult();
    result.payload = payload;
    result.score = score;

    return result;
  };

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'MAX_CONTEXT_LENGTH_IN_WORDS') {
          return '100';
        }

        if (key === 'CHUNK_OVERLAP') {
          return '2';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new ContextService(configService);
  });

  describe('generateContext', () => {
    it('should return an empty array for empty input', () => {
      expect(service.generateContext([])).toEqual([]);
    });

    it('should return chunk text for a single chunk', () => {
      const chunks = [createChunk('doc-1', 0, 'one two three', 0.8)];

      expect(service.generateContext(chunks)).toEqual(['one two three']);

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'MAX_CONTEXT_LENGTH_IN_WORDS',
      );
    });

    it('should group chunks by document and sort them by index before merging', () => {
      const chunks = [
        createChunk('doc-1', 2, 'five six seven', 0.7),
        createChunk('doc-1', 0, 'one two three', 0.9),
        createChunk('doc-1', 1, 'three four five', 0.8),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'one two three five seven',
      ]);
    });

    it('should merge consecutive chunks and remove the configured overlap', () => {
      const chunks = [
        createChunk('doc-1', 0, 'one two three four', 0.7),
        createChunk('doc-1', 1, 'three four five six', 0.9),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'one two three four five six',
      ]);

      expect(configService.getOrThrow).toHaveBeenCalledWith('CHUNK_OVERLAP');
    });

    it('should keep the maximum score when consecutive chunks are merged', () => {
      const chunks = [
        createChunk('doc-1', 0, 'one two three', 0.6),
        createChunk('doc-1', 1, 'three four five', 0.9),
        createChunk('doc-2', 0, 'alpha beta', 0.8),
      ];

      const result = service.generateContext(chunks);

      expect(result).toContain('one two three five');
      expect(result).toContain('alpha beta');
      expect(result).toHaveLength(2);
    });

    it('should not merge chunks when their indexes are not consecutive', () => {
      const chunks = [
        createChunk('doc-1', 0, 'one two', 0.7),
        createChunk('doc-1', 2, 'five six', 0.9),
      ];

      expect(service.generateContext(chunks)).toEqual(['five six', 'one two']);
    });

    it('should merge only consecutive parts and preserve a later non-consecutive chunk', () => {
      const chunks = [
        createChunk('doc-1', 0, 'one two three', 0.6),
        createChunk('doc-1', 1, 'three four five', 0.7),
        createChunk('doc-1', 3, 'nine ten', 0.9),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'nine ten',
        'one two three five',
      ]);
    });

    it('should process different documents independently', () => {
      const chunks = [
        createChunk('doc-2', 1, 'gamma delta epsilon', 0.95),
        createChunk('doc-1', 1, 'three four five', 0.8),
        createChunk('doc-2', 0, 'alpha beta gamma', 0.7),
        createChunk('doc-1', 0, 'one two three', 0.9),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'alpha beta gamma epsilon',
        'one two three five',
      ]);
    });

    it('should sort processed chunks by descending score after document grouping and merging', () => {
      const chunks = [
        createChunk('doc-1', 0, 'low score text', 0.3),
        createChunk('doc-2', 0, 'high score text', 0.9),
        createChunk('doc-3', 0, 'medium score text', 0.6),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'high score text',
        'medium score text',
        'low score text',
      ]);
    });

    it('should include chunks while the total word count does not exceed the configured limit', () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'MAX_CONTEXT_LENGTH_IN_WORDS') {
          return '5';
        }

        if (key === 'CHUNK_OVERLAP') {
          return '0';
        }

        throw new Error(`Unexpected config key: ${key}`);
      });

      const chunks = [
        createChunk('doc-1', 0, 'one two', 0.9),
        createChunk('doc-2', 0, 'three four five', 0.8),
        createChunk('doc-3', 0, 'six seven', 0.7),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'one two',
        'three four five',
      ]);
    });

    it('should skip an oversized chunk and continue checking following chunks', () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'MAX_CONTEXT_LENGTH_IN_WORDS') {
          return '4';
        }

        if (key === 'CHUNK_OVERLAP') {
          return '0';
        }

        throw new Error(`Unexpected config key: ${key}`);
      });

      const chunks = [
        createChunk('doc-1', 0, 'one two three', 0.9),
        createChunk('doc-2', 0, 'four five six seven', 0.8),
        createChunk('doc-3', 0, 'eight', 0.7),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'one two three',
        'eight',
      ]);
    });

    it('should allow a chunk whose word count exactly reaches the limit', () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'MAX_CONTEXT_LENGTH_IN_WORDS') {
          return '3';
        }

        if (key === 'CHUNK_OVERLAP') {
          return '0';
        }

        throw new Error(`Unexpected config key: ${key}`);
      });

      const chunks = [
        createChunk('doc-1', 0, 'one two three', 0.9),
        createChunk('doc-2', 0, 'four', 0.8),
      ];

      expect(service.generateContext(chunks)).toEqual(['one two three']);
    });

    it('should use configuration values for both context length and overlap', () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'MAX_CONTEXT_LENGTH_IN_WORDS') {
          return '20';
        }

        if (key === 'CHUNK_OVERLAP') {
          return '1';
        }

        throw new Error(`Unexpected config key: ${key}`);
      });

      const chunks = [
        createChunk('doc-1', 0, 'one two three', 0.9),
        createChunk('doc-1', 1, 'three four five', 0.8),
      ];

      expect(service.generateContext(chunks)).toEqual([
        'one two three four five',
      ]);

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'MAX_CONTEXT_LENGTH_IN_WORDS',
      );
      expect(configService.getOrThrow).toHaveBeenCalledWith('CHUNK_OVERLAP');
    });

    it('should propagate configuration errors', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() =>
        service.generateContext([createChunk('doc-1', 0, 'one two', 0.9)]),
      ).toThrow('Configuration error');
    });
  });
});

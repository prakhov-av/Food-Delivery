import { UUID } from 'node:crypto';
import { QdrantPayload } from './qdrant-payload';
import { Chunk } from '../../../../ingestion/types/chunk';

/**
   * Определяет типизированную структуру «QdrantPoint», используемую при обмене данными между компонентами.
   */
export class QdrantPoint {
  id: UUID;
  vector: number[];
  payload: Chunk;
}

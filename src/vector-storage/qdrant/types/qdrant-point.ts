import { UUID } from 'node:crypto';
import { QdrantPayload } from './qdrant-payload';

export class QdrantPoint {
  id: UUID;
  vector: number[];
  payload: QdrantPayload;
}

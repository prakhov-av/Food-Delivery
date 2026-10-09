import { QdrantPayload } from './qdrant-payload';

/**
   * Определяет типизированную структуру «QdrantResult», используемую при обмене данными между компонентами.
   */
export class QdrantResult {
  id: string;
  version: number;
  score: number;
  payload: QdrantPayload;
}

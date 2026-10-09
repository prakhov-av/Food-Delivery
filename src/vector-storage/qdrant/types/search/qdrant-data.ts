import { QdrantResult } from './qdrant-result';

/**
   * Определяет типизированную структуру «QdrantData», используемую при обмене данными между компонентами.
   */
export class QdrantData {
  result: QdrantResult[];
}

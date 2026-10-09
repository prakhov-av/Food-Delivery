import { QdrantPoint } from '../search/qdrant-point';

/**
   * Определяет типизированную структуру «QdrantScrollResult», используемую при обмене данными между компонентами.
   */
export class QdrantScrollResult {
  points: QdrantPoint[];
  next_page_offset: string;
}

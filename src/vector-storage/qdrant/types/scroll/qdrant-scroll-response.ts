import { QdrantScrollData } from './qdrant-scroll-data';

/**
   * Определяет типизированную структуру «QdrantScrollResponse», используемую при обмене данными между компонентами.
   */
export class QdrantScrollResponse {
  status: number;
  statusText: string;
  data: QdrantScrollData;
}

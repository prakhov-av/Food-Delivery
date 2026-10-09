import { QdrantData } from './qdrant-data';

/**
   * Определяет типизированную структуру «QdrantResponse», используемую при обмене данными между компонентами.
   */
export class QdrantResponse {
  status: number;
  statusText: string;
  data: QdrantData;
}

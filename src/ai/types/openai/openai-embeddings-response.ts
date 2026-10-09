import { OpenAiEmbedding } from './openai-embedding';

/**
   * Определяет типизированную структуру «OpenAiEmbeddingsResponse», используемую при обмене данными между компонентами.
   */
export class OpenAiEmbeddingsResponse {
  data: OpenAiEmbedding[];
}

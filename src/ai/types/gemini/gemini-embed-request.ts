import { GeminiContent } from './gemini-content';
import { GeminiEmbedContentConfig } from './gemini-embed-content-config';

/**
   * Определяет типизированную структуру «GeminiEmbedRequest», используемую при обмене данными между компонентами.
   */
export class GeminiEmbedRequest {
  content: GeminiContent;
  embedContentConfig: GeminiEmbedContentConfig;
}

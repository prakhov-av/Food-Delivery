import { GeminiContent } from './gemini-content';

/**
   * Определяет типизированную структуру «GeminiChatRequest», используемую при обмене данными между компонентами.
   */
export class GeminiChatRequest {
  contents: GeminiContent[];
}

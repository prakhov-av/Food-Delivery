import { OpenAiMessage } from './openai-message';

/**
   * Определяет типизированную структуру «OpenAiResponse», используемую при обмене данными между компонентами.
   */
export class OpenAiResponse {
  output: OpenAiMessage[];
}

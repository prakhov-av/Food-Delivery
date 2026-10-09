import { OpenAiOutputText } from './openai-output-text';

/**
   * Определяет типизированную структуру «OpenAiMessage», используемую при обмене данными между компонентами.
   */
export class OpenAiMessage {
  content: OpenAiOutputText[];
}

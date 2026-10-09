/**
   * Определяет типизированную структуру «OpenAiRequest», используемую при обмене данными между компонентами.
   */
export class OpenAiRequest {
  model: string;
  input: string | string[];
}

import { GeminiCandidate } from './gemini-candidate';

/**
   * Определяет типизированную структуру «GeminiChatResponse», используемую при обмене данными между компонентами.
   */
export class GeminiChatResponse {
  candidates: GeminiCandidate[];
}

import { GeminiContent } from './gemini-content';

export class GeminiChatRequest {
  contents: GeminiContent[];

  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

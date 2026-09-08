import { Role } from '../users/enums/role.enum';
import { ChatMessage } from './types/chat-message';

export class PromptBuilder {
  private prompt: string;

  constructor(basePrompt: string) {
    this.prompt = basePrompt;
  }

  withUserRole(role: Role): PromptBuilder {
    this.prompt = `${this.prompt}\n\nРоль пользователя:\n${role}`;
    return this;
  }

  withContext(chunks: string[]): PromptBuilder {
    this.prompt = `${this.prompt}\n\nКонтекст:\n\n${chunks.join('\n\n')}\n\nКонец контекста.`;
    return this;
  }

  withChatHistory(chatHistory: ChatMessage[]): PromptBuilder {
    this.prompt = `${this.prompt}\n\nИстория диалога:\n\n${this.mapChatHistoryToMultistring(chatHistory)}\n\nКонец истории диалога.`;
    return this;
  }

  private mapChatHistoryToMultistring(chatHistory: ChatMessage[]): string {
    return chatHistory
      .map(
        (m: ChatMessage): string =>
          `Вопрос пользователя: ${m.userRequest}\nОтвет ИИ ассистента: ${m.aiAnswer}`,
      )
      .join('\n\n');
  }

  withQuestion(request: string): PromptBuilder {
    this.prompt = `${this.prompt}\n\nВопрос пользователя:\n${request}`;
    return this;
  }

  build(): string {
    return this.prompt;
  }
}

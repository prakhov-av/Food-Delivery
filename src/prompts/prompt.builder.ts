import { Role } from '../users/enums/role.enum';
import { ChatMessage } from '../chat/types/chat-message';

/**
 * Последовательно собирает промпт из системных инструкций, роли пользователя, истории диалога, контекста и текущего вопроса.
 */
export class PromptBuilder {
  private prompt: string;

  constructor(basePrompt: string) {
    this.prompt = basePrompt;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withUserRole(role: Role): PromptBuilder {
    this.prompt = `${this.prompt}

User role:
${role}`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withContext(chunks: string[]): PromptBuilder {
    this.prompt = `${this.prompt}

Context:

${chunks.join('\n\n')}

End of context.`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withChatHistory(chatHistory: ChatMessage[]): PromptBuilder {
    this.prompt = `${this.prompt}

Conversation history:

${this.mapChatHistoryToMultistring(chatHistory)}

End of the conversation history.`;
    return this;
  }

  private mapChatHistoryToMultistring(chatHistory: ChatMessage[]): string {
    return chatHistory
      .map(
        (m: ChatMessage): string =>
          `User question: ${m.userRequest}\nAI assistant answer: ${m.aiAnswer}`,
      )
      .join('\n\n');
  }

  withLastOrder(orderId?: number): PromptBuilder {
    if (orderId === undefined) {
      return this;
    }

    this.prompt = `${this.prompt}\n\nLast discussed order: No.${orderId}`;
    return this;
  }
  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withQuestion(request: string): PromptBuilder {
    this.prompt = `${this.prompt}

User question:
${request}`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withDocument(documentText: string): PromptBuilder {
    this.prompt = `${this.prompt}

Document under analysis:

${documentText}

End of the document under analysis.`;
    return this;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  build(): string {
    return this.prompt;
  }
}

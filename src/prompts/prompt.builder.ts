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
    
Роль пользователя:
${role}`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withContext(chunks: string[]): PromptBuilder {
    this.prompt = `${this.prompt}
    
Контекст:

${chunks.join('\n\n')}

Конец контекста.`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withChatHistory(chatHistory: ChatMessage[]): PromptBuilder {
    this.prompt = `${this.prompt}
    
История диалога:

${this.mapChatHistoryToMultistring(chatHistory)}

Конец истории диалога.`;
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

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withQuestion(request: string): PromptBuilder {
    this.prompt = `${this.prompt}
    
Вопрос пользователя:
${request}`;
    return this;
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  withDocument(documentText: string): PromptBuilder {
    this.prompt = `${this.prompt}
    
Анализируемый документ:

${documentText}

Конец анализируемого документа.`;
    return this;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  build(): string {
    return this.prompt;
  }
}

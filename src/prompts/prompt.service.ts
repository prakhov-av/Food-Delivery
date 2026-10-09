import { Injectable } from '@nestjs/common';
import { PromptBuilder } from './prompt.builder';
import {
  BASE_PROMPT_FOR_AI_CHAT,
  BASE_PROMPT_FOR_DOCUMENT_TYPE,
  BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION,
} from './constants/prompt.constants';

/**
   * Предоставляет фабрики построителей промптов для сценариев чата, классификации и проверки безопасности документов.
   */
@Injectable()
export class PromptService {
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  buildPromptForChat(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_AI_CHAT);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  buildPromptForDocumentType(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_DOCUMENT_TYPE);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  buildPromptForDocumentSafetyDetermination(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION);
  }
}

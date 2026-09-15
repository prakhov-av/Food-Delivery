import { Injectable } from '@nestjs/common';
import { PromptBuilder } from './prompt.builder';
import {
  BASE_PROMPT_FOR_AI_CHAT,
  BASE_PROMPT_FOR_DOCUMENT_TYPE,
  BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION,
} from './constants/prompt.constants';

@Injectable()
export class PromptService {
  buildPromptForChat(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_AI_CHAT);
  }

  buildPromptForDocumentType(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_DOCUMENT_TYPE);
  }

  buildPromptForDocumentSafetyDetermination(): PromptBuilder {
    return new PromptBuilder(BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION);
  }
}

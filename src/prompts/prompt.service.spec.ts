import { PromptBuilder } from './prompt.builder';
import { PromptService } from './prompt.service';
import {
  BASE_PROMPT_FOR_AI_CHAT,
  BASE_PROMPT_FOR_DOCUMENT_TYPE,
  BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION,
} from './constants/prompt.constants';

describe('PromptService', (): void => {
  let service: PromptService;

  beforeEach((): void => {
    service = new PromptService();
  });

  describe('buildPromptForChat', (): void => {
    it('should create PromptBuilder with chat prompt', (): void => {
      const result: PromptBuilder = service.buildPromptForChat();

      expect(result).toBeInstanceOf(PromptBuilder);
      expect(result).toEqual(new PromptBuilder(BASE_PROMPT_FOR_AI_CHAT));
    });
  });

  describe('buildPromptForDocumentType', (): void => {
    it('should create PromptBuilder with document type prompt', (): void => {
      const result: PromptBuilder = service.buildPromptForDocumentType();

      expect(result).toBeInstanceOf(PromptBuilder);
      expect(result).toEqual(new PromptBuilder(BASE_PROMPT_FOR_DOCUMENT_TYPE));
    });
  });

  describe('buildPromptForDocumentSafetyDetermination', (): void => {
    it('should create PromptBuilder with document safety prompt', (): void => {
      const result: PromptBuilder =
        service.buildPromptForDocumentSafetyDetermination();

      expect(result).toBeInstanceOf(PromptBuilder);
      expect(result).toEqual(
        new PromptBuilder(BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION),
      );
    });
  });
});

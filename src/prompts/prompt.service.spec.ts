import { PromptBuilder } from './prompt.builder';
import { PromptService } from './prompt.service';
import {
  BASE_PROMPT_FOR_AI_CHAT,
  BASE_PROMPT_FOR_DOCUMENT_TYPE,
  BASE_PROMPT_FOR_DOC_SAFETY_DETERMINATION,
} from './constants/prompt.constants';
import { Lang } from '../chat/locales/lang';
import { LOCALE_PACKS } from '../chat/locales/locale-packs';

describe('PromptService', (): void => {
  let service: PromptService;

  beforeEach((): void => {
    service = new PromptService();
  });

  describe('buildPromptForChat', (): void => {
    it('should create PromptBuilder with chat prompt', (): void => {
      const result: PromptBuilder = service.buildPromptForChat(Lang.RU);

      expect(result).toBeInstanceOf(PromptBuilder);
      expect(result.build()).toContain(BASE_PROMPT_FOR_AI_CHAT);
    });

    it('should add the language directive of the requested language', (): void => {
      const result: string = service.buildPromptForChat(Lang.DE).build();

      expect(result).toContain('German');
      expect(result).toContain(service.canary);
    });
  });

  describe('buildPromptForDocumentType', (): void => {
    it('should create PromptBuilder with document type prompt', (): void => {
      const result: PromptBuilder = service.buildPromptForDocumentType(Lang.RU);

      expect(result).toBeInstanceOf(PromptBuilder);
      expect(result.build()).toContain(BASE_PROMPT_FOR_DOCUMENT_TYPE);
    });

    it('should ask the classifier to rewrite the question in the user language', (): void => {
      const result: string = service.buildPromptForDocumentType(Lang.DE).build();

      expect(result).toContain('Write the standaloneQuestion field in German');
      expect(result).toContain(
        LOCALE_PACKS[Lang.DE].standaloneQuestionExample,
      );
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

  describe('canary', (): void => {
    it('should be part of every prompt and stable within the service', (): void => {
      expect(service.canary.length).toBeGreaterThan(8);
      expect(service.getStaticChatPrompt(Lang.RU)).toContain(service.canary);
      expect(service.getStaticChatPrompt(Lang.EN)).toContain(service.canary);
      expect(service.getStaticChatPrompt(Lang.DE)).toContain(service.canary);
      expect(service.getStaticClassifierPrompt(Lang.RU)).toContain(
        service.canary,
      );
    });

    it('should differ between service instances', (): void => {
      const other: PromptService = new PromptService();

      expect(other.canary).not.toBe(service.canary);
    });
  });
});

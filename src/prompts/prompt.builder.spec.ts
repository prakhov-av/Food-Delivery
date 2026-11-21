import { PromptBuilder } from './prompt.builder';

describe('PromptBuilder', (): void => {
  describe('withLastOrder', (): void => {
    it('should add the last discussed order to the prompt', (): void => {
      const result: string = new PromptBuilder('base')
        .withLastOrder(123)
        .build();

      expect(result.startsWith('base')).toBe(true);
      expect(result).toContain('Last discussed order: No.123');
    });

    it('should leave the prompt unchanged when there is no order id', (): void => {
      const result: string = new PromptBuilder('base')
        .withLastOrder(undefined)
        .build();

      expect(result).toBe('base');
    });

    it('should keep the order of sections in a chain', (): void => {
      const result: string = new PromptBuilder('base')
        .withChatHistory([])
        .withLastOrder(7)
        .withQuestion('вопрос')
        .build();

      const historyEnd: number = result.indexOf('End of the conversation history.');
      const lastOrder: number = result.indexOf('Last discussed order: No.7');
      const question: number = result.lastIndexOf('User question:');

      expect(historyEnd).toBeLessThan(lastOrder);
      expect(lastOrder).toBeLessThan(question);
    });
  });
});

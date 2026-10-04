import { TxtExtractor } from './txt.extractor';

describe('TxtExtractor', (): void => {
  let extractor: TxtExtractor;

  beforeEach((): void => {
    extractor = new TxtExtractor();
  });

  describe('extract', (): void => {
    it('should convert buffer to UTF-8 text', (): void => {
      const text: string = 'Hello, world!\nПривет, мир!';
      const content: Buffer = Buffer.from(text, 'utf-8');

      const result: string = extractor.extract(content);

      expect(result).toBe(text);
    });

    it('should return empty string for empty buffer', (): void => {
      const content: Buffer = Buffer.alloc(0);

      const result: string = extractor.extract(content);

      expect(result).toBe('');
    });
  });
});

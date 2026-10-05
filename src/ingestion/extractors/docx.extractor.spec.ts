import mammoth from 'mammoth';
import { DocxExtractor } from './docx.extractor';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn(),
  },
}));

describe('DocxExtractor', (): void => {
  let extractor: DocxExtractor;

  beforeEach((): void => {
    extractor = new DocxExtractor();
    jest.clearAllMocks();
  });

  describe('extract', (): void => {
    it('should extract raw text from DOCX buffer', async (): Promise<void> => {
      const content: Buffer = Buffer.from('docx content');
      const expectedText: string = 'Extracted DOCX text';

      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: expectedText,
      });

      const result: string = await extractor.extract(content);

      expect(mammoth.extractRawText).toHaveBeenCalledTimes(1);
      expect(mammoth.extractRawText).toHaveBeenCalledWith({
        buffer: content,
      });
      expect(result).toBe(expectedText);
    });

    it('should propagate extraction error', async (): Promise<void> => {
      const content: Buffer = Buffer.from('invalid docx');
      const error: Error = new Error('DOCX extraction failed');

      (mammoth.extractRawText as jest.Mock).mockRejectedValue(error);

      await expect(extractor.extract(content)).rejects.toThrow(
        'DOCX extraction failed',
      );

      expect(mammoth.extractRawText).toHaveBeenCalledWith({
        buffer: content,
      });
    });
  });
});

import { PDFParse, PageTextResult } from 'pdf-parse';
import { PdfExtractor } from './pdf.extractor';

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn(),
}));

describe('PdfExtractor', (): void => {
  let extractor: PdfExtractor;

  beforeEach((): void => {
    extractor = new PdfExtractor();
    jest.clearAllMocks();
  });

  describe('extract', (): void => {
    it('should extract pages from PDF and destroy parser', async (): Promise<void> => {
      const content: Buffer = Buffer.from('pdf content');

      const expectedPages: PageTextResult[] = [
        {
          text: 'First page text',
          num: 1,
        },
        {
          text: 'Second page text',
          num: 2,
        },
      ];

      const parserMock = {
        getText: jest.fn().mockResolvedValue({
          pages: expectedPages,
        }),
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      (PDFParse as unknown as jest.Mock).mockImplementation(() => parserMock);

      const result: PageTextResult[] = await extractor.extract(content);

      expect(PDFParse).toHaveBeenCalledTimes(1);
      expect(PDFParse).toHaveBeenCalledWith({
        data: content,
      });

      expect(parserMock.getText).toHaveBeenCalledTimes(1);
      expect(parserMock.destroy).toHaveBeenCalledTimes(1);

      expect(result).toEqual(expectedPages);
    });

    it('should propagate getText error', async (): Promise<void> => {
      const content: Buffer = Buffer.from('invalid pdf');
      const error: Error = new Error('PDF parsing failed');

      const parserMock = {
        getText: jest.fn().mockRejectedValue(error),
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      (PDFParse as unknown as jest.Mock).mockImplementation(() => parserMock);

      await expect(extractor.extract(content)).rejects.toThrow(
        'PDF parsing failed',
      );

      expect(PDFParse).toHaveBeenCalledWith({
        data: content,
      });

      expect(parserMock.getText).toHaveBeenCalledTimes(1);
      expect(parserMock.destroy).not.toHaveBeenCalled();
    });

    it('should propagate destroy error', async (): Promise<void> => {
      const content: Buffer = Buffer.from('pdf content');
      const error: Error = new Error('PDF destroy failed');

      const expectedPages: PageTextResult[] = [
        {
          text: 'PDF text',
          num: 1,
        },
      ];

      const parserMock = {
        getText: jest.fn().mockResolvedValue({
          pages: expectedPages,
        }),
        destroy: jest.fn().mockRejectedValue(error),
      };

      (PDFParse as unknown as jest.Mock).mockImplementation(() => parserMock);

      await expect(extractor.extract(content)).rejects.toThrow(
        'PDF destroy failed',
      );

      expect(parserMock.getText).toHaveBeenCalledTimes(1);
      expect(parserMock.destroy).toHaveBeenCalledTimes(1);
    });
  });
});

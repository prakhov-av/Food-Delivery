import { MultiformatExtractor } from './multiformat.extractor';
import { TxtExtractor } from './txt.extractor';
import { PdfExtractor } from './pdf.extractor';
import { DocxExtractor } from './docx.extractor';
import { UnsupportedFileFormatException } from '../../exceptions/types/unsupported-file-format.exception';

const createFile = (
  mimetype: string,
  originalname: string = 'document.txt',
): Express.Multer.File =>
  ({
    buffer: Buffer.from('document'),
    mimetype,
    originalname,
  }) as Express.Multer.File;

describe('MultiformatExtractor', (): void => {
  let service: MultiformatExtractor;
  let txtExtractor: jest.Mocked<TxtExtractor>;
  let pdfExtractor: jest.Mocked<PdfExtractor>;
  let docxExtractor: jest.Mocked<DocxExtractor>;

  beforeEach((): void => {
    txtExtractor = {
      extract: jest.fn(),
    } as unknown as jest.Mocked<TxtExtractor>;

    pdfExtractor = {
      extract: jest.fn(),
    } as unknown as jest.Mocked<PdfExtractor>;

    docxExtractor = {
      extract: jest.fn(),
    } as unknown as jest.Mocked<DocxExtractor>;

    service = new MultiformatExtractor(
      txtExtractor,
      docxExtractor,
      pdfExtractor,
    );
  });

  it('should extract plain text as a single page', async (): Promise<void> => {
    txtExtractor.extract.mockReturnValue('plain text');

    const result: string[] = await service.extract(
      createFile('text/plain', 'document.txt'),
    );

    expect(result).toEqual(['plain text']);
    expect(txtExtractor.extract).toHaveBeenCalledWith(Buffer.from('document'));
    expect(pdfExtractor.extract).not.toHaveBeenCalled();
    expect(docxExtractor.extract).not.toHaveBeenCalled();
  });

  it('should map PDF page results to page text', async (): Promise<void> => {
    pdfExtractor.extract.mockResolvedValue([
      { text: 'page one' } as never,
      { text: 'page two' } as never,
    ]);

    const result: string[] = await service.extract(
      createFile('application/pdf', 'document.pdf'),
    );

    expect(result).toEqual(['page one', 'page two']);
    expect(pdfExtractor.extract).toHaveBeenCalledWith(Buffer.from('document'));
    expect(txtExtractor.extract).not.toHaveBeenCalled();
    expect(docxExtractor.extract).not.toHaveBeenCalled();
  });

  it('should split DOCX text by page markers', async (): Promise<void> => {
    docxExtractor.extract.mockResolvedValue(
      'First page — Page 1 — Second page — Page 2 — Third page',
    );

    const result: string[] = await service.extract(
      createFile(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'document.docx',
      ),
    );

    expect(result).toEqual(['First page', 'Second page', 'Third page']);
    expect(docxExtractor.extract).toHaveBeenCalledWith(Buffer.from('document'));
  });

  it('should throw for unsupported file formats', async (): Promise<void> => {
    await expect(
      service.extract(createFile('application/octet-stream', 'document.bin')),
    ).rejects.toBeInstanceOf(UnsupportedFileFormatException);

    expect(txtExtractor.extract).not.toHaveBeenCalled();
    expect(pdfExtractor.extract).not.toHaveBeenCalled();
    expect(docxExtractor.extract).not.toHaveBeenCalled();
  });
});

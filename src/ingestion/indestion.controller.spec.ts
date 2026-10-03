import { IngestionController } from './indestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { Role } from '../users/enums/role.enum';
import { DocumentType } from './enums/document-type.enum';

describe('IngestionController', (): void => {
  let controller: IngestionController;
  const service = {
    ingest: jest.fn(),
  };

  beforeEach((): void => {
    jest.clearAllMocks();
    controller = new IngestionController(
      service as unknown as IngestionService,
    );
  });

  it('should delegate file and DTO to ingestion service', async (): Promise<void> => {
    const file = {
      originalname: 'document.txt',
    } as Express.Multer.File;
    const dto: IngestDocumentDto = {
      documentType: DocumentType.SYSTEM,
      allowedRoles: [Role.ADMIN],
      language: 'en',
      documentVersion: 1,
      documentId: 'document-1',
    };

    service.ingest.mockResolvedValue(undefined);

    await expect(controller.upload(file, dto)).resolves.toBeUndefined();

    expect(service.ingest).toHaveBeenCalledWith(file, dto);
  });

  it('should propagate ingestion service errors', async (): Promise<void> => {
    const file = {
      originalname: 'document.txt',
    } as Express.Multer.File;
    const dto = {} as IngestDocumentDto;
    const error = new Error('ingestion failed');

    service.ingest.mockRejectedValue(error);

    await expect(controller.upload(file, dto)).rejects.toBe(error);
  });
});

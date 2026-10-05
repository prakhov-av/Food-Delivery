import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { IngestDocumentDto } from './ingest-document.dto';
import { DocumentType } from '../enums/document-type.enum';
import { Role } from '../../users/enums/role.enum';

describe('IngestDocumentDto', (): void => {
  it('should preserve allowedRoles when multipart input provides an array', async (): Promise<void> => {
    const dto: IngestDocumentDto = plainToInstance(IngestDocumentDto, {
      documentType: DocumentType.ORDER,
      allowedRoles: [Role.CUSTOMER, Role.COURIER],
      language: 'ru',
      documentVersion: '1',
      documentId: 'document-123',
    });

    const errors = await validate(dto);

    expect(dto.allowedRoles).toEqual([Role.CUSTOMER, Role.COURIER]);
    expect(dto.documentVersion).toBe(1);
    expect(errors).toHaveLength(0);
  });
});

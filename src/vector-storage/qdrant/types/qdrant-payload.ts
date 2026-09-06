import { Role } from '../../../users/enums/role.enum';
import { DocumentType } from '../../../ingestion/enums/document-type.enum';

export class QdrantPayload {
  text: string;
  docTitle: string;
  page: number;
  documentType: DocumentType;
  allowedRoles: Role[];
  language: string;
}

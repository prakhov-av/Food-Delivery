import { Role } from '../../../../users/enums/role.enum';
import { DocumentType } from '../../../../ingestion/enums/document-type.enum';

/**
   * Определяет типизированную структуру «QdrantPayload», используемую при обмене данными между компонентами.
   */
export class QdrantPayload {
  text: string;
  docTitle: string;
  page: number;
  documentType: DocumentType;
  allowedRoles: Role[];
  language: string;
  documentVersion: number;
  documentId: string;
  index: number;
}

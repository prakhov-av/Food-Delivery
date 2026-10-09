import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../enums/document-type.enum';

/**
   * Определяет типизированную структуру «Chunk», используемую при обмене данными между компонентами.
   */
export class Chunk {
  docTitle: string;
  page: number;
  text: string;
  documentType: DocumentType;
  allowedRoles: Role[];
  language: string;
  documentVersion: number;
  documentId: string;
  index: number;
}

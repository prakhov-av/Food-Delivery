import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../enums/document-type.enum';

export class Chunk {
  docTitle: string;
  page: number;
  text: string;
  documentType: DocumentType;
  allowedRoles: Role[];
  language: string;
}

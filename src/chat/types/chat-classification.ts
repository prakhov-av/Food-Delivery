import { DocumentType } from '../../ingestion/enums/document-type.enum';
import { LiveDataResource } from '../enums/live-data-resource.enum';

export class ChatClassification {
  documentType: DocumentType;
  liveDataRequired: boolean;
  resource?: LiveDataResource;
  resourceId?: number;
}

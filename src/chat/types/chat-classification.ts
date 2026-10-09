import { DocumentType } from '../../ingestion/enums/document-type.enum';
import { LiveDataResource } from '../enums/live-data-resource.enum';

/**
   * Определяет типизированную структуру «ChatClassification», используемую при обмене данными между компонентами.
   */
export class ChatClassification {
  documentType: DocumentType;
  liveDataRequired: boolean;
  resource?: LiveDataResource;
  resourceId?: number;
}

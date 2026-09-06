import { Injectable } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { AiService } from '../ai/ai.service';
import { PromptService } from './prompt.service';
import { Role } from '../users/enums/role.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { ChatClassification } from './types/chat-classification';
import { LiveDataService } from './live-data.service';
import { LiveDataResource } from './enums/live-data-resource.enum';

@Injectable()
export class ChatService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly liveDataService: LiveDataService,
  ) {}

  async generateResponse(
    request: string,
    userId: number,
    userRole: Role,
  ): Promise<string> {
    const classifierPrompt: string =
      this.promptService.createPromptForDocumentType(request);

    const classificationResponse: string =
      await this.aiService.generateResponse(classifierPrompt);

    const classification: ChatClassification =
      this.parseClassification(classificationResponse);

    if (classification.liveDataRequired) {
      return this.liveDataService.getLiveData(classification, userId, userRole);
    }

    const documentType: DocumentType = classification.documentType;

    const embedding: number[] = (
      await this.embeddingsService.generateEmbeddings([request])
    )[0];

    const relevantChunks: string[] =
      await this.vectorStorageService.getRelevantChunkByAccess(
        embedding,
        documentType,
        userRole,
      );


    const prompt: string = this.promptService.createPromptForUserRequest(
      relevantChunks,
      request,
    );


    return this.aiService.generateResponse(prompt);
  }

  private parseClassification(value: string): ChatClassification {
    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      throw new ConfigurationException(
        `Invalid chat classification returned by AI: ${value}`,
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('documentType' in parsed) ||
      !('liveDataRequired' in parsed)
    ) {
      throw new ConfigurationException(
        `Invalid chat classification returned by AI: ${value}`,
      );
    }

    const classification = parsed as {
      documentType: unknown;
      liveDataRequired: unknown;
      resource?: unknown;
      resourceId?: unknown;
    };

    const normalizedDocumentType: string =
      typeof classification.documentType === 'string'
        ? classification.documentType.trim().toUpperCase()
        : '';

    if (
      !Object.values(DocumentType).includes(
        normalizedDocumentType as DocumentType,
      )
    ) {
      throw new ConfigurationException(
        `Invalid document type returned by AI: ${String(
          classification.documentType,
        )}`,
      );
    }

    if (typeof classification.liveDataRequired !== 'boolean') {
      throw new ConfigurationException(
        `Invalid liveDataRequired returned by AI: ${String(
          classification.liveDataRequired,
        )}`,
      );
    }

    let normalizedResource: LiveDataResource | undefined;

    if (classification.resource !== undefined) {
      if (
        typeof classification.resource !== 'string' ||
        !Object.values(LiveDataResource).includes(
          classification.resource as LiveDataResource,
        )
      ) {
        throw new ConfigurationException(
          `Invalid live data resource returned by AI: ${String(
            classification.resource,
          )}`,
        );
      }

      normalizedResource = classification.resource as LiveDataResource;
    }

    let normalizedResourceId: number | undefined;

    if (classification.resourceId !== undefined) {
      if (
        typeof classification.resourceId !== 'number' ||
        !Number.isInteger(classification.resourceId) ||
        classification.resourceId <= 0
      ) {
        throw new ConfigurationException(
          `Invalid live data resourceId returned by AI: ${String(
            classification.resourceId,
          )}`,
        );
      }

      normalizedResourceId = classification.resourceId;
    }

    if (
      normalizedResourceId !== undefined &&
      normalizedResource === undefined
    ) {
      throw new ConfigurationException(
        `resourceId requires a resource in chat classification`,
      );
    }

    if (
      classification.liveDataRequired &&
      (normalizedResource === undefined ||
        normalizedResourceId === undefined)
    ) {
      throw new ConfigurationException(
        `Live data classification requires resource and resourceId`,
      );
    }

    if (
      !classification.liveDataRequired &&
      (normalizedResource !== undefined ||
        normalizedResourceId !== undefined)
    ) {
      throw new ConfigurationException(
        `resource and resourceId require liveDataRequired=true`,
      );
    }

    if (
      normalizedResource === LiveDataResource.ORDER &&
      classification.documentType !== DocumentType.ORDER
    ) {
      throw new ConfigurationException(
        `ORDER live data resource requires ORDER document type`,
      );
    }

    return {
      documentType: normalizedDocumentType as DocumentType,
      liveDataRequired: classification.liveDataRequired,
      resource: normalizedResource,
      resourceId: normalizedResourceId,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStorageService } from '../vector-storage/vector-storage.service';
import { AiService } from '../ai/ai.service';
import { PromptService } from '../prompts/prompt.service';
import { Role } from '../users/enums/role.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { ConfigurationException } from '../exceptions/types/configuration.exception';
import { ChatClassification } from './types/chat-classification';
import { LiveDataService } from './live-data.service';
import { LiveDataResource } from './enums/live-data-resource.enum';
import { ChatMessage } from './types/chat-message';
import { QdrantResult } from '../vector-storage/qdrant/types/search/qdrant-result';
import { ContextService } from './context.service';

const MAX_HISTORY_MESSAGES = 10;
const NO_KNOWLEDGE_ANSWER =
  'В базе знаний нет информации по этому вопросу. Попробуйте переформулировать вопрос.';
const MIN_CHUNK_SCORE: number = Number(process.env.CHAT_MIN_SCORE ?? 0);

@Injectable()
export class ChatService {
  private readonly logger: Logger = new Logger(ChatService.name);

  private readonly chatHistory: Map<number, ChatMessage[]> = new Map<
    number,
    ChatMessage[]
  >();

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly liveDataService: LiveDataService,
    private readonly contextService: ContextService,
  ) {}

  async generateResponse(
    request: string,
    userId: number,
    userRole: Role,
  ): Promise<string> {
    const chatHistory: ChatMessage[] = this.getChatHistoryByUserId(userId);

    const classifierPrompt: string = this.promptService
      .buildPromptForDocumentType()
      .withUserRole(userRole)
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logPrompt('Classifier prompt', classifierPrompt);

    const classificationResponse: string =
      await this.aiService.generateResponse(classifierPrompt);

    const classification: ChatClassification = this.classify(
      classificationResponse,
    );

    if (classification.liveDataRequired) {
      const liveDataContext: string = await this.liveDataService.getLiveData(
        classification,
        userId,
        userRole,
      );

      const prompt: string = this.promptService
        .buildPromptForChat()
        .withUserRole(userRole)
        .withContext([liveDataContext])
        .withChatHistory(chatHistory)
        .withQuestion(request)
        .build();

      this.logPrompt('Chat prompt with live data', prompt);

      const aiResponse: string = await this.aiService.generateResponse(prompt);

      this.addChatHistoryByUserId(userId, request, aiResponse);

      return aiResponse;
    }

    const documentType: DocumentType = classification.documentType;

    const embedding: number[] = (
      await this.embeddingsService.generateEmbeddings([request])
    )[0];

    const relevantChunks: QdrantResult[] = (
      await this.vectorStorageService.getRelevantChunkByAccess(
        embedding,
        documentType,
        userRole,
      )
    ).filter(
      (chunk: QdrantResult): boolean => (chunk.score ?? 0) >= MIN_CHUNK_SCORE,
    );

    this.logger.debug(
      `Retrieval: type=${documentType}, role=${userRole}, chunks=${relevantChunks.length}, scores=[${relevantChunks
        .map((c: QdrantResult): string => (c.score ?? 0).toFixed(2))
        .join(', ')}]`,
    );

    if (relevantChunks.length === 0) {
      this.addChatHistoryByUserId(userId, request, NO_KNOWLEDGE_ANSWER);

      return NO_KNOWLEDGE_ANSWER;
    }

    const context: string[] =
      this.contextService.generateContext(relevantChunks);

    const prompt: string = this.promptService
      .buildPromptForChat()
      .withUserRole(userRole)
      .withContext(context)
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logPrompt('Chat prompt', prompt);

    const aiResponse: string = await this.aiService.generateResponse(prompt);

    this.addChatHistoryByUserId(userId, request, aiResponse);

    return aiResponse;
  }

  clearHistory(userId: number): void {
    this.chatHistory.delete(userId);
  }

  /**
   * Промпты содержат персональные данные (имена, заказы, историю диалога),
   * поэтому по умолчанию логируется только размер.
   * Полный текст: CHAT_DEBUG_PROMPTS=true в .env (только для локальной отладки).
   */
  private logPrompt(title: string, prompt: string): void {
    if (process.env.CHAT_DEBUG_PROMPTS === 'true') {
      this.logger.debug(`${title}:\n${prompt}`);
    } else {
      this.logger.debug(`${title}: ${prompt.length} chars`);
    }
  }

  private getChatHistoryByUserId(userId: number): ChatMessage[] {
    return this.chatHistory.get(userId)?.slice(-MAX_HISTORY_MESSAGES) ?? [];
  }

  private addChatHistoryByUserId(
    userId: number,
    userRequest: string,
    aiResponse: string,
  ): void {
    const message: ChatMessage = new ChatMessage();
    message.userRequest = userRequest;
    message.aiAnswer = aiResponse;

    const history: ChatMessage[] = this.chatHistory.get(userId) ?? [];
    history.push(message);

    this.chatHistory.set(userId, history.slice(-MAX_HISTORY_MESSAGES));
  }

  /**
   * Если модель вернула что-то неразбираемое, не роняем запрос:
   * отвечаем как на общий вопрос по системе, без live-данных.
   */
  private classify(value: string): ChatClassification {
    try {
      return this.parseClassification(value);
    } catch (error) {
      this.logger.warn(
        `Classification failed, falling back to SYSTEM: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        documentType: DocumentType.SYSTEM,
        liveDataRequired: false,
        resource: undefined,
        resourceId: undefined,
      };
    }
  }

  /** Вырезает JSON-объект из ответа модели (блоки ```json и текст вокруг). */
  private extractJson(value: string): string {
    const start: number = value.indexOf('{');
    const end: number = value.lastIndexOf('}');

    return start !== -1 && end > start ? value.slice(start, end + 1) : value;
  }

  private parseClassification(value: string): ChatClassification {
    let parsed: unknown;

    try {
      parsed = JSON.parse(this.extractJson(value));
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
        'resourceId requires a resource in chat classification',
      );
    }

    if (classification.liveDataRequired && normalizedResource === undefined) {
      throw new ConfigurationException(
        'Live data classification requires a resource',
      );
    }

    if (
      !classification.liveDataRequired &&
      (normalizedResource !== undefined || normalizedResourceId !== undefined)
    ) {
      throw new ConfigurationException(
        'resource and resourceId require liveDataRequired=true',
      );
    }

    if (
      normalizedResource === LiveDataResource.ORDER &&
      normalizedDocumentType !== DocumentType.ORDER
    ) {
      throw new ConfigurationException(
        'ORDER live data resource requires ORDER document type',
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

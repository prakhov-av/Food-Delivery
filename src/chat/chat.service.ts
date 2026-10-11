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
import { LiveDataResult } from './types/live-data-result';
import { QdrantResult } from '../vector-storage/qdrant/types/search/qdrant-result';
import { ContextService } from './context.service';
import { ChatLog } from './chat-log.entity';
import { ChatLogService } from './chat-log.service';
import { ChatLogKind } from './enums/chat-log-kind.enum';
import { ChatHistoryItemDto } from './dto/chat-history-item.dto';

import { BASE_PROMPT_FOR_AI_CHAT } from '../prompts/constants/prompt.constants';

const MAX_HISTORY_LIMIT = 100;
const MAX_HISTORY_MESSAGES = 10;

interface FinishParams {
  userId: number;
  userRole: Role;
  request: string;
  answer: string;
  kind: ChatLogKind;
  documentType: DocumentType;
  chunksFound?: number;
}

const PROMPT_LEAK_ANSWER =
  'Я не могу показывать внутренние инструкции. Могу помочь с заказами, ресторанами, меню, доставкой и регистрацией.';
const LEAK_SHINGLE_SIZE = 9;
const MAX_STANDALONE_QUESTION_LENGTH = 300;

const toWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

const shingles = (words: string[]): Set<string> => {
  const result: Set<string> = new Set<string>();

  for (let i = 0; i + LEAK_SHINGLE_SIZE <= words.length; i++) {
    result.add(words.slice(i, i + LEAK_SHINGLE_SIZE).join(' '));
  }

  return result;
};

const PROTECTED_PROMPT_TEXT: string = BASE_PROMPT_FOR_AI_CHAT.split(/\n\s*\n/)
  .filter((paragraph: string): boolean => !/рестор/i.test(paragraph))
  .join('\n');

const PROMPT_SHINGLES: Set<string> = shingles(toWords(PROTECTED_PROMPT_TEXT));

const leaksPrompt = (answer: string): boolean =>
  [...shingles(toWords(answer))].some((s: string): boolean =>
    PROMPT_SHINGLES.has(s),
  );

const NO_KNOWLEDGE_ANSWER =
  'В базе знаний нет информации по этому вопросу. Попробуйте переформулировать вопрос.';

const MIN_CHUNK_SCORE: number = Number(process.env.CHAT_MIN_SCORE ?? 0);

/**
 * Оркестрирует ответы чат-ассистента: классифицирует запрос, выбирает актуальные
 * данные приложения или RAG-поиск, учитывает историю диалога и проверяет ответ
 * на утечку системного промпта.
 */
@Injectable()
export class ChatService {
  private readonly logger: Logger = new Logger(ChatService.name);

  private readonly chatHistory: Map<number, ChatMessage[]> = new Map<
    number,
    ChatMessage[]
  >();

  private readonly lastOrderIds: Map<number, number> = new Map<
    number,
    number
  >();

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly liveDataService: LiveDataService,
    private readonly contextService: ContextService,
    private readonly chatLogService: ChatLogService,
  ) {}

  private protectPrompt(answer: string): {
    answer: string;
    blocked: boolean;
  } {
    if (leaksPrompt(answer)) {
      this.logger.warn(
        'Assistant answer repeated the system instructions and was replaced',
      );

      return { answer: PROMPT_LEAK_ANSWER, blocked: true };
    }

    return { answer, blocked: false };
  }

  async generateResponse(
    request: string,
    userId: number,
    userRole: Role,
  ): Promise<string> {
    const chatHistory: ChatMessage[] =
      await this.getChatHistoryByUserId(userId);

    const classifierPrompt: string = this.promptService
      .buildPromptForDocumentType()
      .withUserRole(userRole)
      .withChatHistory(chatHistory)
      .withLastOrder(this.lastOrderIds.get(userId))
      .withQuestion(request)
      .build();

    this.logger.debug(
      `AI classification request started: userId=${userId}, provider=configured, promptLength=${classifierPrompt.length}`,
    );

    const classificationResponse: string =
      await this.aiService.generateResponse(classifierPrompt);

    const classification: ChatClassification = this.classify(
      classificationResponse,
    );

    if (classification.liveDataRequired) {
      const liveData: LiveDataResult = await this.liveDataService.getLiveData(
        classification,
        userId,
        userRole,
      );

      if (liveData.orderId !== undefined) {
        this.lastOrderIds.set(userId, liveData.orderId);
      } else {
        this.lastOrderIds.delete(userId);
      }

      const prompt: string = this.promptService
        .buildPromptForChat()
        .withUserRole(userRole)
        .withContext([liveData.context])
        .withChatHistory(chatHistory)
        .withQuestion(request)
        .build();

      this.logger.debug(
        `AI chat request started: userId=${userId}, mode=live-data, promptLength=${prompt.length}`,
      );

      const protectedAnswer: { answer: string; blocked: boolean } =
        this.protectPrompt(await this.aiService.generateResponse(prompt));

      return this.finish({
        userId,
        userRole,
        request,
        answer: protectedAnswer.answer,
        kind: protectedAnswer.blocked ? ChatLogKind.BLOCKED : ChatLogKind.LIVE,
        documentType: classification.documentType,
      });
    }

    const documentType: DocumentType = classification.documentType;

    const searchQuery: string = classification.standaloneQuestion ?? request;

    if (searchQuery !== request) {
      this.logger.debug(
        `Search query rewritten from chat history: length=${searchQuery.length}`,
      );
    }

    const embedding: number[] = (
      await this.embeddingsService.generateEmbeddings([searchQuery])
    )[0];

    let relevantChunks: QdrantResult[] =
      await this.vectorStorageService.getRelevantChunkByAccess(
        embedding,
        documentType,
        userRole,
      );

    // Классификатор мог ошибиться с темой: ищем по всем документам,
    // доступным роли.
    if (relevantChunks.length === 0) {
      relevantChunks = await this.vectorStorageService.getRelevantChunkByAccess(
        embedding,
        undefined,
        userRole,
      );
    }

    relevantChunks = relevantChunks.filter(
      (chunk: QdrantResult): boolean => (chunk.score ?? 0) >= MIN_CHUNK_SCORE,
    );

    this.logger.debug(
      `Retrieval: type=${documentType}, role=${userRole}, chunks=${relevantChunks.length}, scores=[${relevantChunks
        .map((c: QdrantResult): string => (c.score ?? 0).toFixed(2))
        .join(', ')}]`,
    );

    if (relevantChunks.length === 0) {
      return this.finish({
        userId,
        userRole,
        request,
        answer: NO_KNOWLEDGE_ANSWER,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
        chunksFound: 0,
      });
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

    this.logger.debug(
      `AI chat request started: userId=${userId}, mode=knowledge-base, promptLength=${prompt.length}`,
    );

    const protectedAnswer: { answer: string; blocked: boolean } =
      this.protectPrompt(await this.aiService.generateResponse(prompt));

    return this.finish({
      userId,
      userRole,
      request,
      answer: protectedAnswer.answer,
      kind: protectedAnswer.blocked
        ? ChatLogKind.BLOCKED
        : ChatLogKind.KNOWLEDGE,
      documentType,
      chunksFound: relevantChunks.length,
    });
  }

  /** Очищает только память процесса (вызывается при выходе). */
  clearHistory(userId: number): void {
    this.chatHistory.delete(userId);
    this.lastOrderIds.delete(userId);
  }

  /** Удаляет сохранённую переписку пользователя и память процесса. */
  async clearStoredHistory(userId: number): Promise<void> {
    this.clearHistory(userId);
    await this.chatLogService.deleteByUserId(userId);
  }

  async getHistory(
    userId: number,
    limit: number,
  ): Promise<ChatHistoryItemDto[]> {
    const safeLimit: number = Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT);

    const logs: ChatLog[] = await this.chatLogService.findRecent(
      userId,
      safeLimit,
    );

    return logs.map((log: ChatLog): ChatHistoryItemDto => ({
      id: log.id,
      createdAt: log.createdAt,
      question: log.question,
      answer: log.answer,
      kind: log.kind,
    }));
  }

  private async finish(params: FinishParams): Promise<string> {
    this.addChatHistoryByUserId(params.userId, params.request, params.answer);

    await this.chatLogService.record({
      userId: params.userId,
      userRole: params.userRole,
      question: params.request,
      // Ответы по живым данным устаревают и содержат данные заказов: не храним.
      answer: params.kind === ChatLogKind.LIVE ? null : params.answer,
      kind: params.kind,
      documentType: params.documentType,
      chunksFound: params.chunksFound ?? null,
    });

    return params.answer;
  }

  private async getChatHistoryByUserId(userId: number): Promise<ChatMessage[]> {
    let history: ChatMessage[] | undefined = this.chatHistory.get(userId);

    // Первый вопрос после входа или перезапуска: окно берём из базы.
    if (history === undefined) {
      history = await this.chatLogService.getWindow(
        userId,
        MAX_HISTORY_MESSAGES,
      );
      this.chatHistory.set(userId, history);
    }

    return history.slice(-MAX_HISTORY_MESSAGES);
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
    } catch {
      this.logger.warn(
        'AI classification failed; falling back to SYSTEM classification',
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
        'Invalid chat classification returned by AI',
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('documentType' in parsed) ||
      !('liveDataRequired' in parsed)
    ) {
      throw new ConfigurationException(
        'Invalid chat classification returned by AI',
      );
    }

    const classification = parsed as {
      documentType: unknown;
      liveDataRequired: unknown;
      resource?: unknown;
      resourceId?: unknown;
      standaloneQuestion?: unknown;
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
      throw new ConfigurationException('Invalid document type returned by AI');
    }

    if (typeof classification.liveDataRequired !== 'boolean') {
      throw new ConfigurationException(
        'Invalid liveDataRequired returned by AI',
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

    // Переписанный вопрос необязателен: любое отклонение от формата игнорируем,
    // поиск тогда идёт по исходному вопросу.
    let normalizedStandaloneQuestion: string | undefined;

    if (typeof classification.standaloneQuestion === 'string') {
      const trimmed: string = classification.standaloneQuestion.trim();

      if (
        trimmed.length > 0 &&
        trimmed.length <= MAX_STANDALONE_QUESTION_LENGTH
      ) {
        normalizedStandaloneQuestion = trimmed;
      }
    }

    return {
      documentType: normalizedDocumentType as DocumentType,
      liveDataRequired: classification.liveDataRequired,
      resource: normalizedResource,
      resourceId: normalizedResourceId,
      standaloneQuestion: normalizedStandaloneQuestion,
    };
  }
}

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
import { ChatIdentity, ChatOwner, getChatOwnerKey } from './types/chat-identity';

import {
  BASE_PROMPT_FOR_AI_CHAT,
  PUBLIC_PROMPT_PHRASES,
} from '../prompts/constants/prompt.constants';

const MAX_HISTORY_LIMIT = 100;
const MAX_HISTORY_MESSAGES = 10;
const CLASSIFIER_CACHE_TTL_MS = 10 * 60 * 1000;
const CLASSIFIER_CACHE_LIMIT = 100;
const EMBEDDING_CACHE_LIMIT = 200;
interface CachedClassification {
  raw: string;
  expiresAt: number;
}

interface FinishParams {
  owner: ChatOwner;
  ownerKey: string;
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

const PROMPT_WORDS: string[] = toWords(BASE_PROMPT_FOR_AI_CHAT);

// Слова промпта, входящие в разрешённые для повтора фразы, не защищаем.
const PUBLIC_WORD_MASK: boolean[] = PROMPT_WORDS.map((): boolean => false);

for (const phrase of PUBLIC_PROMPT_PHRASES.map(toWords)) {
  for (let i = 0; i + phrase.length <= PROMPT_WORDS.length; i++) {
    if (
      phrase.every(
        (word: string, j: number): boolean => PROMPT_WORDS[i + j] === word,
      )
    ) {
      phrase.forEach((_: string, j: number): void => {
        PUBLIC_WORD_MASK[i + j] = true;
      });
    }
  }
}

const PROMPT_SHINGLES: Set<string> = new Set<string>();

for (let i = 0; i + LEAK_SHINGLE_SIZE <= PROMPT_WORDS.length; i++) {
  if (!PUBLIC_WORD_MASK.slice(i, i + LEAK_SHINGLE_SIZE).some(Boolean)) {
    PROMPT_SHINGLES.add(PROMPT_WORDS.slice(i, i + LEAK_SHINGLE_SIZE).join(' '));
  }
}

const leaksPrompt = (answer: string): boolean =>
  [...shingles(toWords(answer))].some((s: string): boolean =>
    PROMPT_SHINGLES.has(s),
  );

const INJECTION_PATTERNS: RegExp[] = [
  /системн\p{L}*\s+(?:инструкци\p{L}*|промпт\p{L}*)/iu,
  /(?:покажи|выведи|напиши|повтори|процитируй|раскрой|выдай|пришли|скажи|распечатай|перечисли)\p{L}*\s+(?:мне\s+)?(?:все\s+)?(?:свои|свой|твои|твой|ваши|ваш|внутренние|скрытые)\s+(?:инструкци\p{L}*|промпт\p{L}*)/iu,
  /(?:игнорируй|проигнорируй|забудь|отмени)\p{L}*\s+(?:все\s+)?(?:предыдущ\p{L}*|прежн\p{L}*|прошл\p{L}*|свои|системн\p{L}*)\s+(?:инструкци\p{L}*|указани\p{L}*)/iu,
  /(?:system|hidden|initial|internal)\s+(?:prompt|instructions?)/i,
  /(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules)/i,
  /(?:reveal|show|print|repeat|display|output)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)/i,
];

const isInjectionAttempt = (request: string): boolean =>
  INJECTION_PATTERNS.some((pattern: RegExp): boolean => pattern.test(request));

const CAPABILITIES_ANSWER =
  'Я могу помочь с правилами сервиса (рестораны, меню, заказы и статусы, доставка, регистрация и вход) и вашими текущими заказами.';
const GREETING_ANSWER = `Здравствуйте! ${CAPABILITIES_ANSWER}`;

// Совпадение только полное, после нормализации (регистр, пунктуация):
// «Привет, как отменить заказ?» идёт обычным путём через модель.
const GREETINGS: Set<string> = new Set<string>([
  'привет',
  'приветствую',
  'здравствуй',
  'здравствуйте',
  'добрый день',
  'добрый вечер',
  'доброе утро',
  'hello',
  'hi',
  'hey',
]);

const CAPABILITY_QUESTIONS: Set<string> = new Set<string>([
  'что ты умеешь',
  'что вы умеете',
  'что ты можешь',
  'что вы можете',
  'чем ты можешь помочь',
  'чем вы можете помочь',
  'чем можешь помочь',
  'о чем можно спросить',
  'о чём можно спросить',
  'что можно спросить',
  'what can you do',
  'help',
  'помощь',
]);

const cannedAnswer = (request: string): string | undefined => {
  const normalized: string = toWords(request).join(' ');

  if (GREETINGS.has(normalized)) {
    return GREETING_ANSWER;
  }

  if (CAPABILITY_QUESTIONS.has(normalized)) {
    return CAPABILITIES_ANSWER;
  }

  return undefined;
};

/**
 * C4: запрос про конкретный заказ узнаём без LLM-классификатора.
 *
 * Нужны оба признака сразу: номер заказа в тексте и признак живых данных
 * («что в», «статус», «когда доставят»). По одному номеру шаблон не срабатывает:
 * «Как отменить заказ 195?» — это вопрос про правила, а не про данные заказа.
 */
const ORDER_NUMBER_PATTERN: RegExp =
  /(?<![\p{L}\p{N}])заказ(?:а|е|у|ом)?\s*(?:№\s*)?(\d{1,9})(?![\p{L}\p{N}])/iu;

const LIVE_ORDER_MARKERS: RegExp[] = [
  /(?<![\p{L}])что\s+в(?![\p{L}])/iu,
  /(?<![\p{L}])статус(?:а|е|у|ом)?(?![\p{L}])/iu,
  /(?<![\p{L}])когда\s+достав/iu,
];

// Вопросы о правилах и процедурах («Как изменить статус заказа 195?»): маркер
// «статус» и номер там есть, но данные заказа не нужны, нужна база знаний.
const NOT_ABOUT_ORDER_DATA: RegExp =
  /(?<![\p{L}])(?:как(?![\p{L}])|можно|нельзя|нужно|надо|должен|должна|должно|следует|выгодно|запрещ\p{L}*|почему|зачем|правил\p{L}*|что\s+делать|что\s+значит|что\s+означает|измен\p{L}*|отмен\p{L}*|оформ\p{L}*|созда\p{L}*|оплат\p{L}*|верн\p{L}*|жалоб\p{L}*|принять|принима\p{L}*)/iu;

/** Номер заказа из текста запроса, если это явно запрос про данные заказа. */
const matchLiveOrderId = (request: string): number | undefined => {
  const orderMatch: RegExpExecArray | null = ORDER_NUMBER_PATTERN.exec(request);

  if (orderMatch === null) {
    return undefined;
  }

  // Два числа и больше («заказ 195 за 2 часа», «заказы 195 и 196»): не гадаем.
  if ((request.match(/(?<!\p{N})\d+(?!\p{N})/gu) ?? []).length !== 1) {
    return undefined;
  }

  if (NOT_ABOUT_ORDER_DATA.test(request)) {
    return undefined;
  }

  const hasLiveMarker: boolean = LIVE_ORDER_MARKERS.some(
    (marker: RegExp): boolean => marker.test(request),
  );

  if (!hasLiveMarker) {
    return undefined;
  }

  const orderId: number = Number(orderMatch[1]);

  return Number.isInteger(orderId) && orderId > 0 ? orderId : undefined;
};

/**
 * C5: списочный запрос про заказы («какие у меня заказы», «все заказы»).
 *
 * Классификатор для таких фраз всегда отвечает одинаково: ORDER, живые данные,
 * resourceId не указывается (список доступных заказов). Поэтому маркеров
 * достаточно, чтобы собрать ту же классификацию без вызова модели.
 */
const ORDER_LIST_PATTERNS: RegExp[] = [
  /(?<![\p{L}])какие\s+(?:у\s+меня\s+)?заказы(?![\p{L}])/iu,
  /(?<![\p{L}])все\s+заказы(?![\p{L}])/iu,
  /(?<![\p{L}])мои\s+заказы(?![\p{L}])/iu,
  /(?<![\p{L}])моих\s+заказов(?![\p{L}])/iu,
  /(?<![\p{L}])заказы\s+(?:сейчас\s+)?в\s+работе(?![\p{L}])/iu,
  /(?<![\p{L}])заказы\s+мне\s+назначены(?![\p{L}])/iu,
];

/**
 * «Мой заказ» — заказ один. Отвечаем про последний обсуждаемый: без него
 * запрос остаётся за классификатором, который и решает, о каком заказе речь.
 */
const SINGLE_ORDER_POSSESSIVE: RegExp =
  /(?<![\p{L}])мо(?:й|его|ю|я)\s+заказ(?![\p{L}])/iu;

/**
 * Признаки вопроса, который опирается на предыдущие реплики: местоимение,
 * указывающее на уже названный объект, или союз в начале фразы.
 */
const FOLLOW_UP_PRONOUNS: RegExp =
  /(?<![\p{L}])(?:его|её|ею|им|ими|нём|нему|него|неё|ней|из\s+них|у\s+них|у\s+него|у\s+неё)(?![\p{L}])/iu;

const FOLLOW_UP_START: RegExp = /^\s*(?:а|и|итак|тоже|ну)(?![\p{L}])/iu;

/**
 * Название ресторана или блюда в середине фразы: первое слово пропускаем,
 * иначе обычное начало предложения считалось бы именем собственным.
 */
const hasProperNoun = (text: string): boolean =>
  text
    .split(/\s+/)
    .slice(1)
    .some((word: string): boolean => /^[А-ЯЁA-Z][а-яёa-z]+$/.test(word));

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

  private readonly chatHistory: Map<string, ChatMessage[]> = new Map();

  private readonly lastOrderIds: Map<string, number> = new Map();

  private readonly classificationCache: Map<string, CachedClassification> =
    new Map();
  private readonly embeddingCache: Map<string, Promise<number[]>> = new Map();

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly liveDataService: LiveDataService,
    private readonly contextService: ContextService,
    private readonly chatLogService: ChatLogService,
  ) {}
  /**
   * Предзагружать эмбеддинг стоит только тогда, когда классификатор не станет
   * переписывать вопрос: для уточняющих реплик он вернёт standaloneQuestion,
   * и эмбеддинг исходной фразы уйдёт в пустоту (лишний вызов embeddings).
   *
   * Вопрос про заказы почти всегда уходит в live-ветку, где поиск не нужен.
   */
  private shouldPrefetchEmbedding(
    request: string,
    chatHistory: ChatMessage[],
  ): boolean {
    if (/заказ/i.test(request)) {
      return false;
    }

    // Без истории классификатору нечего переписывать: поиск пойдёт по фразе
    // пользователя, и предзагрузка точно пригодится.
    if (chatHistory.length === 0) {
      return true;
    }

    if (FOLLOW_UP_PRONOUNS.test(request) || FOLLOW_UP_START.test(request)) {
      return false;
    }

    // Предыдущий вопрос был про конкретный ресторан или блюдо, а текущий
    // их не повторяет: скорее всего, это уточняющая реплика.
    const lastRequest: string =
      chatHistory[chatHistory.length - 1]?.userRequest ?? '';

    if (hasProperNoun(lastRequest) && !hasProperNoun(request)) {
      return false;
    }

    return true;
  }

  private embedQuery(text: string): Promise<number[]> {
    const cached: Promise<number[]> | undefined = this.embeddingCache.get(text);

    if (cached) {
      return cached;
    }

    const pending: Promise<number[]> = this.embeddingsService
      .generateEmbeddings([text])
      .then((vectors: number[][]): number[] => vectors[0]);

    this.embeddingCache.set(text, pending);

    if (this.embeddingCache.size > EMBEDDING_CACHE_LIMIT) {
      const oldest: string | undefined = this.embeddingCache
        .keys()
        .next().value;
      if (oldest !== undefined) {
        this.embeddingCache.delete(oldest);
      }
    }

    pending.catch((): void => {
      this.embeddingCache.delete(text);
    });

    return pending;
  }

  private classificationCacheKey(
    userRole: Role,
    request: string,
    history: ChatMessage[],
    lastOrderId: number | undefined,
  ): string {
    const tail: string = history
      .slice(-2)
      .map((message: ChatMessage): string => message.userRequest)
      .join('|');

    return `${userRole}|${lastOrderId ?? ''}|${tail}|${request}`;
  }

  private readClassificationCache(key: string): string | undefined {
    const hit: CachedClassification | undefined =
      this.classificationCache.get(key);

    if (!hit) {
      return undefined;
    }

    if (hit.expiresAt <= Date.now()) {
      this.classificationCache.delete(key);
      return undefined;
    }

    return hit.raw;
  }

  private rememberClassification(key: string, raw: string): void {
    if (!raw.includes('"documentType"')) {
      return;
    }

    this.classificationCache.set(key, {
      raw,
      expiresAt: Date.now() + CLASSIFIER_CACHE_TTL_MS,
    });

    if (this.classificationCache.size > CLASSIFIER_CACHE_LIMIT) {
      const oldest: string | undefined = this.classificationCache
        .keys()
        .next().value;

      if (oldest !== undefined) {
        this.classificationCache.delete(oldest);
      }
    }
  }
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
    return this.generateResponseForIdentity(request, {
      kind: 'user',
      userId,
      role: userRole,
    });
  }

  /** Обрабатывает запрос чата с изолированной идентичностью пользователя или гостя. */
  async generateResponseForIdentity(
    request: string,
    identity: ChatIdentity,
  ): Promise<string> {
    const userRole: Role = identity.role;
    const ownerKey: string = getChatOwnerKey(identity);
    const owner: ChatOwner = identity.kind === 'user'
      ? { userId: identity.userId }
      : { guestSessionId: identity.guestSessionId };
    const identityLabel: string = identity.kind === 'user'
      ? `userId=${identity.userId}`
      : 'guest=true';
    const chatHistory: ChatMessage[] = await this.getChatHistoryByOwner(
      ownerKey,
      owner,
    );

    if (isInjectionAttempt(request)) {
      this.logger.warn(`Prompt injection pattern in request: ${identityLabel}`);
      return this.finish({
        owner, ownerKey, userRole, request,
        answer: PROMPT_LEAK_ANSWER,
        kind: ChatLogKind.BLOCKED,
        documentType: DocumentType.SYSTEM,
      });
    }

    const canned: string | undefined = cannedAnswer(request);
    if (canned !== undefined) {
      return this.finish({
        owner, ownerKey, userRole, request,
        answer: canned,
        kind: ChatLogKind.KNOWLEDGE,
        documentType: DocumentType.SYSTEM,
      });
    }

    const fastLiveClassification: ChatClassification | undefined =
      this.matchLiveClassification(request, ownerKey);

    if (fastLiveClassification !== undefined) {
      return this.answerLive(
        fastLiveClassification, request, identity, ownerKey, chatHistory,
      );
    }

    const lastOrderId = this.lastOrderIds.get(ownerKey);
    const classifierPrompt: string = this.promptService
      .buildPromptForDocumentType()
      .withUserRole(userRole)
      .withChatHistory(chatHistory)
      .withLastOrder(lastOrderId)
      .withQuestion(request)
      .build();

    const classificationKey: string = this.classificationCacheKey(
      userRole,
      request,
      chatHistory,
      lastOrderId,
    );
    const cachedClassification: string | undefined =
      this.readClassificationCache(classificationKey);
    const prefetchedEmbedding: Promise<number[]> | undefined =
      cachedClassification === undefined &&
      this.shouldPrefetchEmbedding(request, chatHistory)
        ? this.embedQuery(request)
        : undefined;

    let classificationResponse: string;
    if (cachedClassification !== undefined) {
      classificationResponse = cachedClassification;
    } else {
      this.logger.debug(
        `AI classification request started: ${identityLabel}, provider=configured, promptLength=${classifierPrompt.length}`,
      );
      classificationResponse = await this.aiService.generateResponse(
        classifierPrompt,
        { classification: true },
      );
      this.rememberClassification(classificationKey, classificationResponse);
    }

    const classification: ChatClassification = this.classify(classificationResponse);
    if (classification.liveDataRequired) {
      return this.answerLive(classification, request, identity, ownerKey, chatHistory);
    }

    const documentType: DocumentType = classification.documentType;
    const searchQuery: string = classification.standaloneQuestion ?? request;
    const embedding: number[] =
      prefetchedEmbedding && searchQuery === request
        ? await prefetchedEmbedding
        : await this.embedQuery(searchQuery);

    let relevantChunks: QdrantResult[] =
      await this.vectorStorageService.getRelevantChunkByAccess(
        embedding, documentType, userRole,
      );

    if (relevantChunks.length === 0) {
      relevantChunks = await this.vectorStorageService.getRelevantChunkByAccess(
        embedding, undefined, userRole,
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
        owner, ownerKey, userRole, request,
        answer: NO_KNOWLEDGE_ANSWER,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
        chunksFound: 0,
      });
    }

    const context: string[] = this.contextService.generateContext(relevantChunks);
    const prompt: string = this.promptService
      .buildPromptForChat()
      .withUserRole(userRole)
      .withContext(context)
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logger.debug(
      `AI chat request started: ${identityLabel}, mode=knowledge-base, promptLength=${prompt.length}`,
    );
    const protectedAnswer = this.protectPrompt(
      await this.aiService.generateResponse(prompt),
    );

    return this.finish({
      owner, ownerKey, userRole, request,
      answer: protectedAnswer.answer,
      kind: protectedAnswer.blocked ? ChatLogKind.BLOCKED : ChatLogKind.KNOWLEDGE,
      documentType,
      chunksFound: relevantChunks.length,
    });
  }

  /** Очищает только память процесса для зарегистрированного пользователя. */
  clearHistory(userId: number): void {
    this.clearHistoryByOwnerKey(`user:${userId}`);
  }

  clearHistoryForIdentity(identity: ChatIdentity): void {
    this.clearHistoryByOwnerKey(getChatOwnerKey(identity));
  }

  private clearHistoryByOwnerKey(ownerKey: string): void {
    this.chatHistory.delete(ownerKey);
    this.lastOrderIds.delete(ownerKey);
  }

  async clearStoredHistory(userId: number): Promise<void> {
    this.clearHistory(userId);
    await this.chatLogService.deleteByUserId(userId);
  }

  async clearStoredHistoryForIdentity(identity: ChatIdentity): Promise<void> {
    this.clearHistoryForIdentity(identity);
    if (identity.kind === 'user') {
      await this.chatLogService.deleteByUserId(identity.userId);
    } else {
      await this.chatLogService.deleteByGuestSessionId(identity.guestSessionId);
    }
  }

  async getHistory(userId: number, limit: number): Promise<ChatHistoryItemDto[]> {
    return this.getHistoryForIdentity(
      { kind: 'user', userId, role: Role.CUSTOMER },
      limit,
    );
  }

  async getHistoryForIdentity(
    identity: ChatIdentity,
    limit: number,
  ): Promise<ChatHistoryItemDto[]> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT);
    const logs: ChatLog[] = identity.kind === 'user'
      ? await this.chatLogService.findRecent(identity.userId, safeLimit)
      : await this.chatLogService.findRecentByGuestSessionId(
          identity.guestSessionId, safeLimit,
        );
    return logs.map((log): ChatHistoryItemDto => ({
      id: log.id,
      createdAt: log.createdAt,
      question: log.question,
      answer: log.answer,
      kind: log.kind,
    }));
  }

  private matchLiveClassification(
    request: string,
    ownerKey: string,
  ): ChatClassification | undefined {
    const explicitOrderId: number | undefined = matchLiveOrderId(request);
    if (explicitOrderId !== undefined) {
      return {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: LiveDataResource.ORDER,
        resourceId: explicitOrderId,
      };
    }

    if (NOT_ABOUT_ORDER_DATA.test(request)) return undefined;
    const lastOrderId: number | undefined = this.lastOrderIds.get(ownerKey);

    if (ORDER_LIST_PATTERNS.some((pattern: RegExp): boolean => pattern.test(request))) {
      return {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: LiveDataResource.ORDER,
      };
    }

    if (lastOrderId !== undefined && SINGLE_ORDER_POSSESSIVE.test(request)) {
      return {
        documentType: DocumentType.ORDER,
        liveDataRequired: true,
        resource: LiveDataResource.ORDER,
        resourceId: lastOrderId,
      };
    }
    return undefined;
  }

  private async answerLive(
    classification: ChatClassification,
    request: string,
    identity: ChatIdentity,
    ownerKey: string,
    chatHistory: ChatMessage[],
  ): Promise<string> {
    const userRole: Role = identity.role;
    const owner: ChatOwner = identity.kind === 'user'
      ? { userId: identity.userId }
      : { guestSessionId: identity.guestSessionId };
    const liveData: LiveDataResult = identity.kind === 'user'
      ? await this.liveDataService.getLiveData(
          classification,
          identity.userId,
          identity.role,
        )
      : await this.liveDataService.getLiveData(classification, identity);

    if (liveData.orderId !== undefined) {
      this.lastOrderIds.set(ownerKey, liveData.orderId);
    } else {
      this.lastOrderIds.delete(ownerKey);
    }

    const prompt: string = this.promptService
      .buildPromptForChat()
      .withUserRole(userRole)
      .withContext([liveData.context])
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logger.debug(
      `AI chat request started: ${identity.kind === 'user' ? `userId=${identity.userId}` : 'guest=true'}, mode=live-data, promptLength=${prompt.length}`,
    );
    const protectedAnswer = this.protectPrompt(
      await this.aiService.generateResponse(prompt),
    );

    return this.finish({
      owner, ownerKey, userRole, request,
      answer: protectedAnswer.answer,
      kind: protectedAnswer.blocked ? ChatLogKind.BLOCKED : ChatLogKind.LIVE,
      documentType: classification.documentType,
    });
  }

  private async finish(params: FinishParams): Promise<string> {
    this.addChatHistoryByOwnerKey(params.ownerKey, params.request, params.answer);
    await this.chatLogService.record({
      ...params.owner,
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

  private async getChatHistoryByOwner(
    ownerKey: string,
    owner: ChatOwner,
  ): Promise<ChatMessage[]> {
    let history = this.chatHistory.get(ownerKey);
    if (history === undefined) {
      history = owner.userId !== undefined
        ? await this.chatLogService.getWindow(owner.userId, MAX_HISTORY_MESSAGES)
        : await this.chatLogService.getWindowByGuestSessionId(
            owner.guestSessionId!,
            MAX_HISTORY_MESSAGES,
          );
      this.chatHistory.set(ownerKey, [...history]);
    }
    return history.slice(-MAX_HISTORY_MESSAGES);
  }

  private addChatHistoryByOwnerKey(
    ownerKey: string,
    userRequest: string,
    aiResponse: string,
  ): void {
    const message = new ChatMessage();
    message.userRequest = userRequest;
    message.aiAnswer = aiResponse;
    const history = this.chatHistory.get(ownerKey) ?? [];
    history.push(message);
    this.chatHistory.set(ownerKey, history.slice(-MAX_HISTORY_MESSAGES));
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

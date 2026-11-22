import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { LanguageService } from './language/language.service';
import { LeakGuardService } from './leak-guard.service';
import { ALL_LANGS, DEFAULT_LANG, Lang } from './locales/lang';
import { LocalePack } from './locales/locale-pack';
import { ChatBranch } from './enums/chat-branch.enum';
import {
  ALL_FOLLOW_UP_PRONOUNS,
  ALL_FOLLOW_UP_START,
  ALL_INJECTION_PATTERNS,
  ALL_LIVE_ORDER_MARKERS,
  ALL_NOT_ABOUT_ORDER_DATA,
  ALL_ORDER_LIST_PATTERNS,
  ALL_ORDER_MENTIONS,
  ALL_ORDER_NUMBER_PATTERNS,
  ALL_SINGLE_ORDER_POSSESSIVE,
  LOCALE_PACKS,
} from './locales/locale-packs';

const MAX_HISTORY_LIMIT = 100;
const MAX_HISTORY_MESSAGES = 10;
const CLASSIFIER_CACHE_TTL_MS = 10 * 60 * 1000;
const CLASSIFIER_CACHE_LIMIT = 500;
const EMBEDDING_CACHE_LIMIT = 200;

/**
 * Сколько сессий держится в памяти.
 *
 * Карты памяти процесса живут, пока живёт процесс: без границы каждый
 * гость добавлял ключ, и память росла вместе с числом посетителей.
 */
const MAX_SESSION_ENTRIES = 5000;

/** Сколько живёт кэш готового ответа. */
const ANSWER_CACHE_TTL_MS = 5 * 60 * 1000;

/** Сколько ответов помещается в кэш. */
const ANSWER_CACHE_LIMIT = 200;

/**
 * Слова, по которым видно, что ответ привязан к предыдущим репликам.
 *
 * Такой ответ нельзя отдавать другому вопросу с тем же текстом: он
 * потеряет смысл без контекста диалога. В кэш попадают только ответы,
 * которые сами по себе.
 */
const CONTEXT_BOUND_MARKERS: RegExp[] = [
  /вы\s+(уже\s+)?спрашива/i,
  /вы\s+упомянули/i,
  /как\s+я\s+(уже\s+)?(сказал|объяснил|ответил)/i,
  /как\s+я\s+отвечал/i,
  /выше\s+я\s+(написал|сказал|упомянул)/i,
  /предыдущ(ий|его|ем)\s+(вопрос|сообщени|реплик|отв)/i,
  /вы\s+уточняли/i,
  /as\s+(you\s+)?(asked|mentioned)\s+(earlier|before|above)/i,
  /like\s+(you\s+)?(asked|mentioned)\s+(earlier|before|above)/i,
  /your\s+(previous|last)\s+(question|message)/i,
  /(wie\s+)?sie\s+haben\s+(vorher|früher)\s+gefragt/i,
  /ihre\s+(letzte|vorige)\s+frage/i,
  /wie\s+ich\s+(schon\s+)?gesagt\s+habe/i,
];

/** Сколько сообщений в сутки разрешено одной идентичности. */
const DEFAULT_DAILY_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

interface CachedClassification {
  raw: string;
  expiresAt: number;
}

interface CachedAnswer {
  answer: string;
  documentType: DocumentType;
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

/**
 * Состояние одного запроса.
 *
 * Живёт вместе с запросом: по нему считается число вызовов модели и
 * пишется строка метрик с веткой обработки.
 */
interface ChatRequestContext {
  lang: Lang;
  branch: ChatBranch;
  llmCalls: number;
  startedAt: number;
  /** Дневной лимит уже проверен в этом запросе. */
  limitChecked: boolean;
}

/**
 * Результат распознавания запроса про заказы.
 *
 * useTemplate отвечает на вопрос, показывать ли сырой блок заказа или
 * отдать данные модели, чтобы она сформулировала ответ на конкретный
 * вопрос пользователя.
 */
interface LiveMatch {
  classification: ChatClassification;
  useTemplate: boolean;
}

const MAX_STANDALONE_QUESTION_LENGTH = 300;

/**
 * Порог релевантности, ниже которого поиск продолжается на другом языке.
 *
 * Если по языку пользователя нашлось только слабо подходящие фрагменты,
 * лучше отдать документ на языке по умолчанию, чем ответить «нет информации».
 */
const DEFAULT_LANG_FALLBACK_MIN_SCORE = 0.3;

/**
 * Порог релевантности фрагмента: ниже него фрагмент не идёт в контекст.
 *
 * Ноль по умолчанию: порог подбирается по eval-набору, а не на глаз.
 */
const DEFAULT_MIN_CHUNK_SCORE = 0;

const toWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Название ресторана или блюда в середине фразы. */
const hasProperNoun = (text: string): boolean =>
  text
    .split(/\s+/)
    .slice(1)
    .some((word: string): boolean => /^\p{Lu}\p{Ll}+$/u.test(word));

/**
 * Нормализация текста перед проверкой инъекций.
 *
 *  - NFKC сворачивает совместимые символы (например, полноширинные буквы).
 *  - Символы нулевой ширины вырезаются: «ignore<ZWSP> all previous» иначе
 *    проходит мимо регексов.
 *  - Пробелы схлопываются, чтобы переносы строк не ломали шаблоны.
 */
const normalizeForDetection = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Приветствия и вопросы о возможностях по всем языкам. */
const ALL_GREETINGS: Set<string> = new Set(
  ALL_LANGS.flatMap((lang: Lang): string[] => LOCALE_PACKS[lang].greetings),
);

const ALL_CAPABILITY_QUESTIONS: Set<string> = new Set(
  ALL_LANGS.flatMap((lang: Lang): string[] =>
    LOCALE_PACKS[lang].capabilityQuestions,
  ),
);

/**
 * Оркестрирует ответы чат-ассистента: определяет язык, классифицирует запрос,
 * выбирает актуальные данные приложения или RAG-поиск, учитывает историю
 * диалога и проверяет ответ на утечку системного промпта.
 */
@Injectable()
export class ChatService {
  private readonly logger: Logger = new Logger(ChatService.name);

  private readonly chatHistory: Map<string, ChatMessage[]> = new Map();

  private readonly lastOrderIds: Map<string, number> = new Map();

  private readonly classificationCache: Map<string, CachedClassification> =
    new Map();
  private readonly embeddingCache: Map<string, Promise<number[]>> = new Map();
  private readonly answerCache: Map<string, CachedAnswer> = new Map();

  /** Порог релевантности фрагмента. */
  private readonly minChunkScore: number;

  /** Порог, ниже которого поиск повторяется на другом языке. */
  private readonly langFallbackMinScore: number;

  /** Сколько сообщений в сутки разрешено одной идентичности. */
  private readonly dailyLimit: number;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStorageService: VectorStorageService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly liveDataService: LiveDataService,
    private readonly contextService: ContextService,
    private readonly chatLogService: ChatLogService,
    private readonly languageService: LanguageService,
    private readonly leakGuardService: LeakGuardService,
    private readonly configService: ConfigService,
  ) {
    this.minChunkScore = this.readNumber(
      'CHAT_MIN_SCORE',
      DEFAULT_MIN_CHUNK_SCORE,
    );
    this.langFallbackMinScore = this.readNumber(
      'CHAT_LANG_FALLBACK_MIN_SCORE',
      DEFAULT_LANG_FALLBACK_MIN_SCORE,
    );
    this.dailyLimit = this.readNumber('CHAT_DAILY_LIMIT', DEFAULT_DAILY_LIMIT);
  }

  /**
   * Читает числовую настройку из конфигурации.
   *
   * Настройки читаются через ConfigService, а не из process.env на уровне
   * модуля: process.env в момент импорта ещё не содержит .env, и локально
   * значения молча игнорировались.
   */
  private readNumber(key: string, fallback: number): number {
    const raw: unknown = this.configService.get(key);

    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }

    const value: number = Number(raw);

    return Number.isFinite(value) ? value : fallback;
  }

  /**
   * Кладёт значение в карту памяти, ограничивая её размер.
   *
   * Значение становится самым свежим, а самое старое вытесняется, когда
   * карта переполняется.
   */
  private setBounded<K, V>(
    map: Map<K, V>,
    key: K,
    value: V,
    limit: number = MAX_SESSION_ENTRIES,
  ): void {
    map.delete(key);
    map.set(key, value);

    if (map.size > limit) {
      const oldest: K | undefined = map.keys().next().value;

      if (oldest !== undefined) {
        map.delete(oldest);
      }
    }
  }

  /**
   * Предзагружать эмбеддинг стоит только тогда, когда классификатор не станет
   * переписывать вопрос: для уточняющих реплик он вернёт standaloneQuestion,
   * и эмбеддинг исходной фразы уйдёт в пустоту (лишний вызов embeddings).
   *
   * Вопрос про заказы предзагружается только когда спрашивают про правила
   * («Как отменить заказ?»): такой вопрос уходит в базу знаний, и без
   * предзагрузки ответ ждал три запроса подряд — классификатор, эмбеддинг,
   * генерация. Вопрос про данные заказа («статус моего заказа») уходит в
   * живую ветку, где поиск не нужен.
   */
  private shouldPrefetchEmbedding(
    request: string,
    chatHistory: ChatMessage[],
  ): boolean {
    // Уточняющая реплика: классификатор перепишет вопрос.
    if (chatHistory.length > 0 && this.isFollowUp(request, chatHistory)) {
      return false;
    }

    if (this.looksLikeOrderQuestion(request)) {
      return this.isNotAboutOrderData(request);
    }

    return true;
  }

  /**
   * Уточняющая реплика: вопрос продолжает предыдущую тему.
   *
   * От этого зависит, попадёт ли история в ключ кэша классификации.
   */
  private isFollowUp(request: string, chatHistory: ChatMessage[]): boolean {
    if (chatHistory.length === 0) {
      return false;
    }

    if (
      ALL_FOLLOW_UP_PRONOUNS.some((pattern: RegExp): boolean =>
        pattern.test(request),
      ) ||
      ALL_FOLLOW_UP_START.some((pattern: RegExp): boolean => pattern.test(request))
    ) {
      return true;
    }

    // Предыдущий вопрос был про конкретный ресторан или блюдо, а текущий
    // их не повторяет: скорее всего, это уточняющая реплика.
    const lastRequest: string =
      chatHistory[chatHistory.length - 1]?.userRequest ?? '';

    return hasProperNoun(lastRequest) && !hasProperNoun(request);
  }

  /** Вопрос про заказы по любому из поддерживаемых языков. */
  private looksLikeOrderQuestion(request: string): boolean {
    if (
      ALL_ORDER_MENTIONS.some((pattern: RegExp): boolean =>
        pattern.test(request),
      )
    ) {
      return true;
    }

    if (
      ALL_ORDER_LIST_PATTERNS.some((pattern: RegExp): boolean =>
        pattern.test(request),
      )
    ) {
      return true;
    }

    return ALL_ORDER_NUMBER_PATTERNS.some((pattern: RegExp): boolean =>
      pattern.test(request),
    );
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
    lang: Lang,
  ): string {
    // История попадает в ключ только для уточняющих реплик: для обычного
    // вопроса история меняла ключ, и кэш почти никогда не попадал.
    const tail: string = this.isFollowUp(request, history)
      ? history
          .slice(-2)
          .map((message: ChatMessage): string => message.userRequest)
          .join('|')
      : '';

    return `${userRole}|${lang}|${lastOrderId ?? ''}|${tail}|${request}`;
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

  /**
   * Ключ кэша готовых ответов.
   *
   * Кэшируются только ответы из базы знаний: они не зависят от состояния
   * заказов и одинаковы для всех гостей с тем же вопросом.
   */
  private answerCacheKey(
    userRole: Role,
    request: string,
    lang: Lang,
  ): string {
    const normalized: string = request
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    return `${lang}|${userRole}|${normalized}`;
  }

  private readAnswerCache(key: string): CachedAnswer | undefined {
    const hit: CachedAnswer | undefined = this.answerCache.get(key);

    if (!hit) {
      return undefined;
    }

    if (hit.expiresAt <= Date.now()) {
      this.answerCache.delete(key);
      return undefined;
    }

    return hit;
  }

  private rememberAnswer(
    key: string,
    answer: string,
    documentType: DocumentType,
  ): void {
    this.answerCache.set(key, {
      answer,
      documentType,
      expiresAt: Date.now() + ANSWER_CACHE_TTL_MS,
    });

    if (this.answerCache.size > ANSWER_CACHE_LIMIT) {
      const oldest: string | undefined = this.answerCache.keys().next().value;

      if (oldest !== undefined) {
        this.answerCache.delete(oldest);
      }
    }
  }

  /**
   * Привязан ли ответ к предыдущим репликам диалога.
   *
   * Такой ответ нельзя отдать другому гостю с тем же вопросом: без контекста
   * он теряет смысл. Определение по словам намеренно грубое: лишний ответ,
   * который не попадёт в кэш, безопаснее, чем перепутанный ответ у гостя.
   */
  private refersToEarlierTurn(answer: string): boolean {
    return CONTEXT_BOUND_MARKERS.some((marker: RegExp): boolean =>
      marker.test(answer),
    );
  }

  private protectPrompt(
    answer: string,
    pack: LocalePack,
  ): { answer: string; blocked: boolean } {
    if (this.leakGuardService.isLeaking(answer)) {
      this.logger.warn(
        'Assistant answer repeated the system instructions and was replaced',
      );

      return { answer: pack.promptLeakAnswer, blocked: true };
    }

    return { answer, blocked: false };
  }

  /**
   * Выполняет внешний вызов, не роняя запрос.
   *
   * Сбой провайдера (лимит, таймаут, недоступность базы) не должен
   * выглядеть как поломка приложения: пользователь получает внятный ответ.
   */
  private async safely<T>(
    label: string,
    job: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await job();
    } catch (error) {
      this.logger.error(
        `${label} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      return undefined;
    }
  }

  /**
   * Вызов модели с учётом счётчика вызовов.
   */
  private async callModel(
    ctx: ChatRequestContext,
    prompt: string,
    options?: { classification?: boolean },
  ): Promise<string | undefined> {
    ctx.llmCalls += 1;

    return this.safely('AI generation', () =>
      this.aiService.generateResponse(prompt, options),
    );
  }

  /**
   * Попытка инъекции промпта.
   *
   * Паттерны берутся из всех языковых паков сразу: атакующий пишет на любом
   * языке независимо от того, какой язык определился для запроса.
   */
  private isInjectionAttempt(request: string): boolean {
    const normalized: string = normalizeForDetection(request);

    if (normalized.length === 0) {
      return false;
    }

    return ALL_INJECTION_PATTERNS.some((pattern: RegExp): boolean =>
      pattern.test(normalized),
    );
  }

  /**
   * Ответ без вызова модели: приветствие или вопрос о возможностях.
   *
   * Совпадение проверяется по всем языкам (слово приветствия может быть
   * прислано на любом из них), а сам ответ отдаётся на языке пользователя.
   */
  private cannedAnswer(
    request: string,
    pack: LocalePack,
  ): string | undefined {
    const normalized: string = toWords(request).join(' ');

    if (ALL_GREETINGS.has(normalized)) {
      return pack.greetingAnswer;
    }

    if (ALL_CAPABILITY_QUESTIONS.has(normalized)) {
      return pack.capabilitiesAnswer;
    }

    return undefined;
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

  /**
   * Проверяет дневной лимит сообщений для идентичности.
   *
   * Счётчик считается по журналу чата: он уже есть и не требует
   * дополнительного хранилища.
   */
  private async dailyLimitAnswer(
    ctx: ChatRequestContext,
    owner: ChatOwner,
    pack: LocalePack,
  ): Promise<string | undefined> {
    if (this.dailyLimit <= 0) {
      return undefined;
    }

    // Проверка нужна один раз на запрос: запрос может дойти до модели и по
    // пути классификатора, и по пути живых данных.
    if (ctx.limitChecked) {
      return undefined;
    }

    ctx.limitChecked = true;

    const since: Date = new Date(Date.now() - DAY_MS);

    const count: number | undefined = await this.safely(
      'Daily limit check',
      () => this.chatLogService.countSince(owner, since),
    );

    // Сбой проверки не должен блокировать чат: неизвестный счётчик
    // трактуется как «лимит не исчерпан».
    if (count === undefined || count < this.dailyLimit) {
      return undefined;
    }

    return pack.dailyLimitAnswer;
  }

  /** Обрабатывает запрос чата с изолированной идентичностью пользователя или гостя. */
  async generateResponseForIdentity(
    request: string,
    identity: ChatIdentity,
    explicitLang?: Lang,
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

    // Язык определяется один раз на входе и дальше едет вместе с запросом.
    const lang: Lang = this.languageService.resolve(
      explicitLang,
      request,
      ownerKey,
    );
    const pack: LocalePack = LOCALE_PACKS[lang];

    const ctx: ChatRequestContext = {
      lang,
      branch: ChatBranch.NO_KNOWLEDGE,
      llmCalls: 0,
      startedAt: Date.now(),
      limitChecked: false,
    };

    if (this.isInjectionAttempt(request)) {
      ctx.branch = ChatBranch.INJECTION;
      this.logger.warn(`Prompt injection pattern in request: ${identityLabel}`);

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.promptLeakAnswer,
        kind: ChatLogKind.BLOCKED,
        documentType: DocumentType.SYSTEM,
      });
    }

    const canned: string | undefined = this.cannedAnswer(request, pack);
    if (canned !== undefined) {
      ctx.branch = ChatBranch.CANNED;

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: canned,
        kind: ChatLogKind.KNOWLEDGE,
        documentType: DocumentType.SYSTEM,
      });
    }

    const fastLiveMatch: LiveMatch | undefined =
      this.matchLiveClassification(request, ownerKey);

    if (fastLiveMatch !== undefined) {
      // Вопрос про заказы распознан без модели: данные из БД уже готовы
      // и подписаны на языке пользователя.
      return this.answerLive(
        ctx, fastLiveMatch.classification, request, identity, ownerKey,
        chatHistory, lang, fastLiveMatch.useTemplate,
      );
    }

    // Ответы из базы знаний не зависят от состояния заказов: одинаковый
    // вопрос получает одинаковый ответ. Вопрос, который не уточняет
    // предыдущую реплику, кэшируется даже при наличии истории: ответ всё
    // равно одинаковый, а экономия — два запроса к модели.
    const cacheable: boolean = !this.isFollowUp(request, chatHistory);
    const answerCacheKey: string | undefined = cacheable
      ? this.answerCacheKey(userRole, request, lang)
      : undefined;

    if (answerCacheKey !== undefined) {
      const cachedAnswer: CachedAnswer | undefined =
        this.readAnswerCache(answerCacheKey);

      if (cachedAnswer !== undefined) {
        ctx.branch = ChatBranch.RAG;

        return this.finish(ctx, {
          owner, ownerKey, userRole, request,
          answer: cachedAnswer.answer,
          kind: ChatLogKind.KNOWLEDGE,
          documentType: cachedAnswer.documentType,
        });
      }
    }

    const lastOrderId = this.lastOrderIds.get(ownerKey);

    // Дневной лимит ограничивает расход на модель, поэтому он проверяется
    // перед первым вызовом модели, а не перед шаблонными ответами: список
    // заказов и ответ по номеру остаются доступными всегда.
    const limited: string | undefined = await this.dailyLimitAnswer(
      ctx,
      owner,
      pack,
    );
    if (limited !== undefined) {
      ctx.branch = ChatBranch.NO_KNOWLEDGE;

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: limited,
        kind: ChatLogKind.NO_ANSWER,
        documentType: DocumentType.SYSTEM,
      });
    }

    const classifierPrompt: string = this.promptService
      .buildPromptForDocumentType(lang)
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
      lang,
    );
    const cachedClassification: string | undefined =
      this.readClassificationCache(classificationKey);
    const prefetchedEmbedding: Promise<number[]> | undefined =
      cachedClassification === undefined &&
      this.shouldPrefetchEmbedding(request, chatHistory)
        ? this.embedQuery(request)
        : undefined;

    let classificationResponse: string | undefined;
    if (cachedClassification !== undefined) {
      classificationResponse = cachedClassification;
    } else {
      this.logger.debug(
        `AI classification request started: ${identityLabel}, lang=${lang}, provider=configured, promptLength=${classifierPrompt.length}`,
      );
      classificationResponse = await this.callModel(ctx, classifierPrompt, {
        classification: true,
      });

      if (classificationResponse === undefined) {
        return this.finish(ctx, {
          owner, ownerKey, userRole, request,
          answer: pack.unavailableAnswer,
          kind: ChatLogKind.NO_ANSWER,
          documentType: DocumentType.SYSTEM,
        });
      }

      this.rememberClassification(classificationKey, classificationResponse);
    }

    const classification: ChatClassification = this.classify(classificationResponse);
    if (classification.liveDataRequired) {
      return this.answerLive(
        ctx, classification, request, identity, ownerKey, chatHistory, lang,
        false,
      );
    }

    const documentType: DocumentType = classification.documentType;
    const searchQuery: string = classification.standaloneQuestion ?? request;
    const embeddingPromise: Promise<number[]> =
      prefetchedEmbedding && searchQuery === request
        ? prefetchedEmbedding
        : this.embedQuery(searchQuery);

    const embedding: number[] | undefined = await this.safely(
      'Embedding generation',
      () => embeddingPromise,
    );

    if (embedding === undefined) {
      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.unavailableAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
      });
    }

    const relevantChunks: QdrantResult[] | undefined = await this.searchChunks(
      embedding, documentType, userRole, lang,
    );

    if (relevantChunks === undefined) {
      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.unavailableAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
      });
    }

    // Слабые фрагменты в контекст не берём: дешевле ответить «нет информации».
    const strongChunks: QdrantResult[] = relevantChunks.filter(
      (chunk: QdrantResult): boolean => (chunk.score ?? 0) >= this.minChunkScore,
    );

    this.logger.debug(
      `Retrieval: type=${documentType}, role=${userRole}, lang=${lang}, chunks=${strongChunks.length}, scores=[${strongChunks
        .map((c: QdrantResult): string => (c.score ?? 0).toFixed(2))
        .join(', ')}]`,
    );

    if (strongChunks.length === 0) {
      ctx.branch = ChatBranch.NO_KNOWLEDGE;

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.noKnowledgeAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
        chunksFound: 0,
      });
    }

    const context: string[] = this.contextService.generateContext(strongChunks);
    const prompt: string = this.promptService
      .buildPromptForChat(lang)
      .withUserRole(userRole)
      .withContext(context)
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logger.debug(
      `AI chat request started: ${identityLabel}, mode=knowledge-base, lang=${lang}, promptLength=${prompt.length}`,
    );

    const rawAnswer: string | undefined = await this.callModel(ctx, prompt);

    if (rawAnswer === undefined) {
      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.unavailableAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType,
        chunksFound: strongChunks.length,
      });
    }

    const protectedAnswer = this.protectPrompt(rawAnswer, pack);

    if (
      answerCacheKey !== undefined &&
      !protectedAnswer.blocked &&
      !this.refersToEarlierTurn(protectedAnswer.answer)
    ) {
      this.rememberAnswer(
        answerCacheKey,
        protectedAnswer.answer,
        documentType,
      );
    }

    ctx.branch = protectedAnswer.blocked ? ChatBranch.INJECTION : ChatBranch.RAG;

    return this.finish(ctx, {
      owner, ownerKey, userRole, request,
      answer: protectedAnswer.answer,
      kind: protectedAnswer.blocked ? ChatLogKind.BLOCKED : ChatLogKind.KNOWLEDGE,
      documentType,
      chunksFound: strongChunks.length,
    });
  }

  /**
   * Ищет фрагменты базы знаний с учётом языка.
   *
   * Порядок попыток: язык пользователя → язык по умолчанию → любой язык →
   * любой тип документа. Попытка следующего языка делается, только если
   * лучший результат текущего хуже порога: иначе качественный ответ на
   * языке пользователя не был бы заменён документом на другом языке.
   *
   * undefined означает, что все попытки провалились: наверху отдаётся
   * ответ о недоступности сервиса, а не «нет информации».
   */
  private async searchChunks(
    embedding: number[],
    documentType: DocumentType,
    userRole: Role,
    lang: Lang,
  ): Promise<QdrantResult[] | undefined> {
    const attempts: { lang?: Lang; documentType?: DocumentType }[] = [
      { lang, documentType },
    ];

    if (lang !== DEFAULT_LANG) {
      attempts.push({ lang: DEFAULT_LANG, documentType });
    }

    attempts.push({ documentType });
    attempts.push({});

    let best: QdrantResult[] = [];
    let bestScore: number = -1;
    let failures: number = 0;

    for (const attempt of attempts) {
      const chunks: QdrantResult[] | undefined = await this.safely(
        'Qdrant search',
        () =>
          this.vectorStorageService.getRelevantChunkByAccess(
            embedding,
            attempt.documentType,
            userRole,
            attempt.lang,
          ),
      );

      if (chunks === undefined) {
        failures += 1;
        continue;
      }

      const score: number = this.topScore(chunks);

      if (score > bestScore) {
        best = chunks;
        bestScore = score;
      }

      if (score >= this.langFallbackMinScore) {
        return chunks;
      }
    }

    if (failures === attempts.length) {
      return undefined;
    }

    return best;
  }

  private topScore(chunks: QdrantResult[]): number {
    if (chunks.length === 0) {
      return -1;
    }

    return Math.max(
      ...chunks.map((chunk: QdrantResult): number => chunk.score ?? 0),
    );
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
    this.languageService.clearSessionLang(ownerKey);
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
    return logs.map((log: ChatLog): ChatHistoryItemDto => ({
      id: log.id,
      createdAt: log.createdAt,
      question: log.question,
      answer: log.answer,
      kind: log.kind,
    }));
  }

  /**
   * Распознаёт запрос про заказы без LLM-классификатора.
   *
   * Шаблон (useTemplate) остаётся для списка заказов и для запроса
   * «номер + маркер»: там данные и есть ответ. Вопрос «мой заказ» —
   * это конкретный вопрос пользователя, поэтому данные уходят модели,
   * и она формулирует ответ по вопросу.
   */
  private matchLiveClassification(
    request: string,
    ownerKey: string,
  ): LiveMatch | undefined {
    const explicitOrderId: number | undefined = this.matchLiveOrderId(request);
    if (explicitOrderId !== undefined) {
      return {
        classification: {
          documentType: DocumentType.ORDER,
          liveDataRequired: true,
          resource: LiveDataResource.ORDER,
          resourceId: explicitOrderId,
        },
        useTemplate: true,
      };
    }

    if (this.isNotAboutOrderData(request)) return undefined;
    const lastOrderId: number | undefined = this.lastOrderIds.get(ownerKey);

    if (
      ALL_ORDER_LIST_PATTERNS.some((pattern: RegExp): boolean =>
        pattern.test(request),
      )
    ) {
      return {
        classification: {
          documentType: DocumentType.ORDER,
          liveDataRequired: true,
          resource: LiveDataResource.ORDER,
        },
        useTemplate: true,
      };
    }

    if (
      lastOrderId !== undefined &&
      ALL_SINGLE_ORDER_POSSESSIVE.some((pattern: RegExp): boolean =>
        pattern.test(request),
      )
    ) {
      return {
        classification: {
          documentType: DocumentType.ORDER,
          liveDataRequired: true,
          resource: LiveDataResource.ORDER,
          resourceId: lastOrderId,
        },
        useTemplate: false,
      };
    }

    return undefined;
  }

  private isNotAboutOrderData(request: string): boolean {
    return ALL_NOT_ABOUT_ORDER_DATA.some((pattern: RegExp): boolean =>
      pattern.test(request),
    );
  }

  /**
   * C4: запрос про конкретный заказ узнаём без LLM-классификатора.
   *
   * Нужны оба признака сразу: номер заказа в тексте и признак живых данных
   * («что в», «статус», «когда доставят»). По одному номеру шаблон не
   * срабатывает: «Как отменить заказ 195?» — это вопрос про правила, а не
   * про данные заказа.
   */
  private matchLiveOrderId(request: string): number | undefined {
    const orderMatch: RegExpExecArray | null =
      this.execOrderNumberPattern(request);

    if (orderMatch === null) {
      return undefined;
    }

    // Два числа и больше («заказ 195 за 2 часа», «заказы 195 и 196»): не гадаем.
    if ((request.match(/(?<!\p{N})\d+(?!\p{N})/gu) ?? []).length !== 1) {
      return undefined;
    }

    if (this.isNotAboutOrderData(request)) {
      return undefined;
    }

    const hasLiveMarker: boolean = ALL_LIVE_ORDER_MARKERS.some(
      (marker: RegExp): boolean => marker.test(request),
    );

    if (!hasLiveMarker) {
      return undefined;
    }

    const orderId: number = Number(orderMatch[1]);

    return Number.isInteger(orderId) && orderId > 0 ? orderId : undefined;
  }

  private execOrderNumberPattern(request: string): RegExpExecArray | null {
    for (const pattern of ALL_ORDER_NUMBER_PATTERNS) {
      const match: RegExpExecArray | null = pattern.exec(request);

      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  private async answerLive(
    ctx: ChatRequestContext,
    classification: ChatClassification,
    request: string,
    identity: ChatIdentity,
    ownerKey: string,
    chatHistory: ChatMessage[],
    lang: Lang,
    useTemplate: boolean,
  ): Promise<string> {
    const userRole: Role = identity.role;
    const owner: ChatOwner = identity.kind === 'user'
      ? { userId: identity.userId }
      : { guestSessionId: identity.guestSessionId };
    const pack: LocalePack = LOCALE_PACKS[lang];
    const identityLabel: string = identity.kind === 'user'
      ? `userId=${identity.userId}`
      : 'guest=true';

    const liveData: LiveDataResult | undefined = await this.safely(
      'Live data request',
      () =>
        identity.kind === 'user'
          ? this.liveDataService.getLiveData(
              classification,
              identity.userId,
              identity.role,
              lang,
            )
          : this.liveDataService.getLiveData(
              classification,
              identity,
              undefined,
              lang,
            ),
    );

    if (liveData === undefined) {
      ctx.branch = ChatBranch.LIVE_LLM;

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.unavailableAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType: classification.documentType,
      });
    }

    if (liveData.orderId !== undefined) {
      this.setBounded(this.lastOrderIds, ownerKey, liveData.orderId);
    } else {
      this.lastOrderIds.delete(ownerKey);
    }

    if (useTemplate) {
      // Данные уже собраны и подписаны на языке пользователя.
      // Формировать текст через модель незачем: это лишний вызов LLM.
      ctx.branch = ChatBranch.LIVE_TEMPLATE;

      this.logger.debug(
        `AI chat request skipped: ${identityLabel}, mode=live-data-template, lang=${lang}`,
      );

      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: liveData.context,
        kind: ChatLogKind.LIVE,
        documentType: classification.documentType,
      });
    }

    ctx.branch = ChatBranch.LIVE_LLM;

    // Ответ формулирует модель, поэтому дневной лимит проверяется здесь.
    const limited: string | undefined = await this.dailyLimitAnswer(
      ctx,
      owner,
      pack,
    );
    if (limited !== undefined) {
      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: limited,
        kind: ChatLogKind.NO_ANSWER,
        documentType: classification.documentType,
      });
    }

    const prompt: string = this.promptService
      .buildPromptForChat(lang)
      .withUserRole(userRole)
      .withContext([liveData.context])
      .withChatHistory(chatHistory)
      .withQuestion(request)
      .build();

    this.logger.debug(
      `AI chat request started: ${identityLabel}, mode=live-data, lang=${lang}, promptLength=${prompt.length}`,
    );

    const rawAnswer: string | undefined = await this.callModel(ctx, prompt);

    if (rawAnswer === undefined) {
      return this.finish(ctx, {
        owner, ownerKey, userRole, request,
        answer: pack.unavailableAnswer,
        kind: ChatLogKind.NO_ANSWER,
        documentType: classification.documentType,
      });
    }

    const protectedAnswer = this.protectPrompt(rawAnswer, pack);

    return this.finish(ctx, {
      owner, ownerKey, userRole, request,
      answer: protectedAnswer.answer,
      kind: protectedAnswer.blocked ? ChatLogKind.BLOCKED : ChatLogKind.LIVE,
      documentType: classification.documentType,
    });
  }

  /**
   * Записывает ответ в историю и журнал.
   *
   * Ошибка записи в журнал не должна ронять ответ: он уже готов, и
   * пользователь не должен получать 500 из-за недоступной базы.
   */
  private finish(
    ctx: ChatRequestContext,
    params: FinishParams,
  ): Promise<string> {
    this.addChatHistoryByOwnerKey(params.ownerKey, params.request, params.answer);

    this.logger.log(
      `chat branch=${ctx.branch} lang=${ctx.lang} llmCalls=${ctx.llmCalls} ` +
        `durationMs=${Date.now() - ctx.startedAt}`,
    );

    return this.chatLogService
      .record({
        ...params.owner,
        userRole: params.userRole,
        question: params.request,
        // Ответы по живым данным устаревают и содержат данные заказов: не храним.
        answer: params.kind === ChatLogKind.LIVE ? null : params.answer,
        kind: params.kind,
        documentType: params.documentType,
        chunksFound: params.chunksFound ?? null,
      })
      .then((): string => params.answer)
      .catch((error: unknown): string => {
        this.logger.error(
          `Failed to record chat log: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        return params.answer;
      });
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
      this.setBounded(this.chatHistory, ownerKey, [...history]);
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
    this.setBounded(
      this.chatHistory,
      ownerKey,
      history.slice(-MAX_HISTORY_MESSAGES),
    );
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

  /** Вырезает JSON-объект из ответа модели (блок ```json и текст вокруг). */
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

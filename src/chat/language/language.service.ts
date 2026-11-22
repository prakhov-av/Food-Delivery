import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { detectAll } from 'tinyld';
import { DEFAULT_LANG, Lang, parseLang } from '../locales/lang';

/**
 * Minimum message length the detector may be trusted with.
 *
 * On short messages ("Hallo", "ok", "yes") the detector guesses wrong more
 * often than right, so there the language comes from the interface setting
 * or from the previous message of the session.
 */
const DEFAULT_MIN_DETECT_CHARS = 40;

/** Minimum word count for the detector to be trusted. */
const DEFAULT_MIN_DETECT_WORDS = 5;

/**
 * Minimum accuracy the detector must reach.
 *
 * Без порога детектор угадывает язык по первому совпадению: французский
 * текст получал немецкий, если немецкий где-то в хвосте списка.
 */
const DEFAULT_MIN_DETECT_ACCURACY = 0.5;

/**
 * Maximum number of remembered session languages.
 *
 * Карта живёт в памяти процесса и без границы растёт от каждого гостя.
 */
const MAX_SESSION_LANGS = 5000;

/**
 * Determines the language of a request once, at the entry point, and keeps
 * it for the session.
 *
 * Priority of the sources:
 * 1. Explicit choice (the language selected in the interface) always wins.
 * 2. The detector, but only for long messages.
 * 3. The language of the previous message of the same session.
 * 4. The default language.
 */
@Injectable()
export class LanguageService {
  /** Language of the last request per session (a user or a guest). */
  private readonly sessionLangs: Map<string, Lang> = new Map();

  /** Minimum accuracy the detector must reach to be trusted. */
  private readonly minDetectAccuracy: number;

  constructor(private readonly configService: ConfigService) {
    const configured: number = Number(
      this.configService.get('CHAT_LANG_DETECT_MIN_ACCURACY') ??
        DEFAULT_MIN_DETECT_ACCURACY,
    );

    this.minDetectAccuracy =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_MIN_DETECT_ACCURACY;
  }

  /**
   * Returns the language of the request and remembers it for the session.
   *
   * @param explicit Language chosen by the client (the interface setting).
   * @param message Text of the user message.
   * @param ownerKey Session key (a user or a guest).
   */
  resolve(
    explicit: Lang | undefined,
    message: string,
    ownerKey: string,
  ): Lang {
    const lang: Lang = this.resolveLanguage(explicit, message, ownerKey);

    this.rememberSessionLang(ownerKey, lang);

    return lang;
  }

  /**
   * Запоминает язык сессии, не давая карте расти без границы.
   *
   * Каждый гость добавлял ключ, и на длинной жизни процесса карта
   * съедала память.
   */
  private rememberSessionLang(ownerKey: string, lang: Lang): void {
    this.sessionLangs.delete(ownerKey);
    this.sessionLangs.set(ownerKey, lang);

    if (this.sessionLangs.size > MAX_SESSION_LANGS) {
      const oldest: string | undefined = this.sessionLangs.keys().next().value;

      if (oldest !== undefined) {
        this.sessionLangs.delete(oldest);
      }
    }
  }

  /** Language remembered for the session. */
  getSessionLang(ownerKey: string): Lang | undefined {
    return this.sessionLangs.get(ownerKey);
  }

  /** Forgets the session language together with the conversation history. */
  clearSessionLang(ownerKey: string): void {
    this.sessionLangs.delete(ownerKey);
  }

  /**
   * Detects the language of a text, ignoring the session.
   *
   * Used for long messages only: on short phrases the detector is not
   * reliable enough.
   *
   * Решение принимает лучший результат детектора, а не первый
   * поддерживаемый: иначе французский текст получал немецкий, если
   * немецкий встречался дальше в списке.
   */
  private detect(message: string): Lang | undefined {
    if (!this.isLongEnough(message)) {
      return undefined;
    }

    const detections: { lang: string; accuracy: number }[] = detectAll(message);

    const top: { lang: string; accuracy: number } | undefined =
      detections[0];

    if (!top || top.accuracy < this.minDetectAccuracy) {
      return undefined;
    }

    const topLang: Lang | undefined = parseLang(top.lang);

    if (topLang !== undefined) {
      return topLang;
    }

    // Язык на первом месте не поддерживается: берём лучший из поддерживаемых,
    // но только если детектор в нём уверен.
    for (const detection of detections.slice(1)) {
      if (detection.accuracy < this.minDetectAccuracy) {
        continue;
      }

      const lang: Lang | undefined = parseLang(detection.lang);

      if (lang !== undefined) {
        return lang;
      }
    }

    return undefined;
  }

  private resolveLanguage(
    explicit: Lang | undefined,
    message: string,
    ownerKey: string,
  ): Lang {
    if (explicit !== undefined) {
      return explicit;
    }

    const detected: Lang | undefined = this.detect(message);

    if (detected !== undefined) {
      return detected;
    }

    return this.sessionLangs.get(ownerKey) ?? DEFAULT_LANG;
  }

  private isLongEnough(message: string): boolean {
    const minChars: number = Number(
      this.configService.get('CHAT_LANG_DETECT_MIN_CHARS') ??
        DEFAULT_MIN_DETECT_CHARS,
    );
    const minWords: number = Number(
      this.configService.get('CHAT_LANG_DETECT_MIN_WORDS') ??
        DEFAULT_MIN_DETECT_WORDS,
    );

    const trimmed: string = message.trim();

    if (trimmed.length < minChars) {
      return false;
    }

    return trimmed.split(/\s+/).length >= minWords;
  }
}

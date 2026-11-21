import { Injectable } from '@nestjs/common';
import { PromptService } from '../prompts/prompt.service';
import { ALL_LANGS } from './locales/lang';
import { LOCALE_PACKS } from './locales/locale-packs';

/** Shingle size: this many words in a row count as a match with the prompt. */
const LEAK_SHINGLE_SIZE = 9;

/**
 * Splits text into words for the comparison with the prompt.
 *
 * Case and punctuation are ignored: a leak may be rephrased or translated,
 * but the word sequence of the prompt is preserved.
 */
const toWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Builds the shingles of a word list.
 */
const shingles = (words: string[]): Set<string> => {
  const result: Set<string> = new Set<string>();

  for (let i = 0; i + LEAK_SHINGLE_SIZE <= words.length; i++) {
    result.add(words.slice(i, i + LEAK_SHINGLE_SIZE).join(' '));
  }

  return result;
};

/**
 * Protects the system prompt from leaking.
 *
 * Two independent mechanisms:
 *
 * 1. A canary: a random token inside the prompt. An answer containing it
 *    is treated as a leak. It works in every answer language, so a
 *    translated leak is caught as well.
 * 2. Shingles: comparison of the answer with the prompt. It catches verbatim
 *    copying, but not a translation: a translated text has other words.
 *
 * The shingles are built from all language versions of the prompt at once:
 * a leak does not have to be in the language of the current request.
 */
@Injectable()
export class LeakGuardService {
  /** Shingles of every language version of the prompt. Built once, lazily. */
  private promptShingles: Set<string> | null = null;

  constructor(private readonly promptService: PromptService) {}

  /** The answer repeats a word sequence of the prompt. */
  leaksByShingles(answer: string): boolean {
    const promptShingles: Set<string> = this.getPromptShingles();

    if (promptShingles.size === 0) {
      return false;
    }

    return [...shingles(toWords(answer))].some((shingle: string): boolean =>
      promptShingles.has(shingle),
    );
  }

  /** The answer contains the canary of the prompt. */
  containsCanary(answer: string): boolean {
    const canary: string = this.promptService.canary;

    if (canary.length === 0) {
      return false;
    }

    const normalized: string = answer.toLowerCase();
    const loweredCanary: string = canary.toLowerCase();

    if (normalized.includes(loweredCanary)) {
      return true;
    }

    // The token without the prefix: the model may have reformatted it.
    const bare: string = loweredCanary.replace(/^fd-/, '');

    return bare.length >= 8 && normalized.includes(bare);
  }

  /** Any sign of a leak. */
  isLeaking(answer: string): boolean {
    return this.containsCanary(answer) || this.leaksByShingles(answer);
  }

  private getPromptShingles(): Set<string> {
    if (this.promptShingles !== null) {
      return this.promptShingles;
    }

    const result: Set<string> = new Set<string>();

    for (const lang of ALL_LANGS) {
      const text: string = this.promptService.getStaticChatPrompt(lang);
      const words: string[] = toWords(text);
      const mask: boolean[] = words.map((): boolean => false);

      // Wordings the assistant is allowed to repeat are not protected.
      for (const phrase of LOCALE_PACKS[lang].publicPhrases) {
        this.markPhrase(words, mask, toWords(phrase));
      }

      for (let i = 0; i + LEAK_SHINGLE_SIZE <= words.length; i++) {
        if (!mask.slice(i, i + LEAK_SHINGLE_SIZE).some(Boolean)) {
          result.add(words.slice(i, i + LEAK_SHINGLE_SIZE).join(' '));
        }
      }
    }

    this.promptShingles = result;

    return result;
  }

  private markPhrase(words: string[], mask: boolean[], phrase: string[]): void {
    if (phrase.length === 0) {
      return;
    }

    for (let i = 0; i + phrase.length <= words.length; i++) {
      const matches: boolean = phrase.every(
        (word: string, j: number): boolean => words[i + j] === word,
      );

      if (matches) {
        phrase.forEach((_: string, j: number): void => {
          mask[i + j] = true;
        });
      }
    }
  }
}

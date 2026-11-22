import { Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Коды ответов, при которых запрос имеет смысл повторить.
 *
 * 429 — лимит провайдера, 5xx — его перегрузка. Остальное (400, 401, 404)
 * повторять бессмысленно: запрос от этого не станет корректнее.
 */
const RETRYABLE_STATUSES: number[] = [408, 429, 500, 502, 503, 504];

/** Сколько попыток делаем по умолчанию. */
const MAX_ATTEMPTS: number = 3;

/** Пауза перед второй и третьей попыткой по умолчанию, мс. */
const RETRY_DELAYS_MS: number[] = [1000, 3000];

/** Таймаут одного запроса к провайдеру по умолчанию, мс. */
const DEFAULT_TIMEOUT_MS: number = 120_000;

const logger: Logger = new Logger('AiClient');

/**
 * Настройки повторов.
 *
 * Вынесены в параметры, чтобы тесты не ждали реальные паузы.
 */
export interface AiRetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelaysMs?: number[];
}

/**
 * Временная ошибка провайдера: лимит запросов, перегрузка, обрыв сети.
 *
 * Ошибка без ответа (обрыв сети, таймаут) тоже временная: запрос к API
 * можно повторить.
 */
const isRetryable = (status: number | undefined): boolean =>
  status === undefined || RETRYABLE_STATUSES.includes(status);

/**
 * POST с повторами при временных ошибках провайдера.
 *
 * Без повторов лимит запросов к Gemini превращался в 500: один сбой
 * провайдера ронял загрузку документа и запрос чата целиком. С повторами
 * тот же запрос доводится до успеха.
 */
export async function postWithRetry<T>(
  url: string,
  body: unknown,
  config: AxiosRequestConfig,
  label: string,
  options: AiRetryOptions = {},
): Promise<AxiosResponse<T>> {
  const timeoutMs: number = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts: number = options.maxAttempts ?? MAX_ATTEMPTS;
  const delays: number[] = options.retryDelaysMs ?? RETRY_DELAYS_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await axios.post<T>(url, body, { ...config, timeout: timeoutMs });
    } catch (error) {
      lastError = error;

      const status: number | undefined = (
        error as { response?: { status?: number } }
      )?.response?.status;

      if (!isRetryable(status) || attempt === maxAttempts) {
        throw error;
      }

      const delay: number = delays[attempt - 1] ?? delays[delays.length - 1] ?? 0;

      logger.warn(
        `${label} failed with status ${status ?? 'network error'}, ` +
          `retry ${attempt}/${maxAttempts} in ${delay}ms`,
      );

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

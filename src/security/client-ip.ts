import { createHash } from 'crypto';
import type { Request } from 'express';

/**
 * Определение клиента для троттлинга и журнала аудита.
 *
 * Проблема: приложение стоит за Cloudflare, поэтому в `req.ip` попадает
 * адрес edge-сервера Cloudflare, а не адрес пользователя. Все посетители
 * сайта делят один счётчик лимитов: пять попыток входа в минуту на всех.
 *
 * Решение: реальный адрес приходит двумя путями.
 *  - `X-Client-IP` — ставит nginx фронта, он берёт его из `CF-Connecting-IP`
 *    на границе с Cloudflare. Этот путь работает и для трафика, который
 *    фронт проксирует на API (same-origin).
 *  - `CF-Connecting-IP` — Cloudflare всегда перезаписывает этот заголовок
 *    реальным адресом клиента, подменить его нельзя.
 *
 * Если адрес определить не удалось, используется `req.ip` — как и раньше.
 */

/** Заголовок с реальным адресом клиента, который ставит nginx фронта. */
const CLIENT_IP_HEADER = 'x-client-ip';

/** Заголовок Cloudflare с реальным адресом клиента. */
const CLOUDFLARE_IP_HEADER = 'cf-connecting-ip';

/** Cookie идентификатора устройства: ставится фронтом, секретов не содержит. */
export const DEVICE_COOKIE = 'fd_device';

/** Cookie гостевой сессии. */
const GUEST_SESSION_COOKIE = 'guest-session';

/** Cookie с JWT зарегистрированного пользователя. */
const ACCESS_TOKEN_COOKIE = 'access-token';

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

/**
 * Возвращает значение заголовка запроса или null,
 * если заголовка нет или он пустой.
 */
function readHeader(value: string | string[] | undefined): string | null {
  const raw: string | undefined = Array.isArray(value) ? value[0] : value;

  if (raw === undefined) {
    return null;
  }

  const trimmed: string = raw.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Возвращает значение cookie по имени или null.
 */
export function readCookie(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separatorIndex: number = part.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    if (part.slice(0, separatorIndex).trim() !== cookieName) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Проверяет, что значение похоже на IP-адрес.
 * Нужно, чтобы случайная строка из заголовка не попала в журнал и счётчик.
 */
function looksLikeIp(value: string): boolean {
  return IPV4_PATTERN.test(value) || IPV6_PATTERN.test(value);
}

/**
 * Определяет реальный адрес клиента.
 */
export function resolveClientIp(request: Request): string {
  const fromFrontendProxy: string | null = readHeader(
    request.headers[CLIENT_IP_HEADER],
  );

  if (fromFrontendProxy !== null && looksLikeIp(fromFrontendProxy)) {
    return fromFrontendProxy;
  }

  const fromCloudflare: string | null = readHeader(
    request.headers[CLOUDFLARE_IP_HEADER],
  );

  if (fromCloudflare !== null && looksLikeIp(fromCloudflare)) {
    return fromCloudflare;
  }

  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

/**
 * Хеширует идентификатор, чтобы в ключах троттлинга
 * и в журнале не лежали почты и токены в открытом виде.
 */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Достаёт почту пользователя из access-токена без проверки подписи.
 *
 * Токен здесь нужен только как идентификатор счётчика лимитов:
 * подпись всё равно проверяет AuthGuard, а сам троттлинг
 * не даёт никаких прав.
 */
function readEmailFromAccessToken(token: string): string | null {
  const parts: string[] = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );

    if (
      payload !== null &&
      typeof payload === 'object' &&
      'email' in payload &&
      typeof payload.email === 'string'
    ) {
      return (payload as { email: string }).email;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Идентификатор клиента для троттлинга.
 *
 * Порядок важен: сначала идентичность запроса (пользователь, гостевая
 * сессия, устройство), и только потом адрес. Иначе все пользователи сайта
 * делили бы один счётчик и любой мог исчерпать лимит остальным.
 */
export function resolveThrottleTracker(request: Request): string {
  const cookies: string | undefined = request.headers.cookie;

  const accessToken: string | null = readCookie(cookies, ACCESS_TOKEN_COOKIE);

  if (accessToken) {
    const email: string | null = readEmailFromAccessToken(accessToken);

    return email !== null
      ? `user:${hashIdentifier(email)}`
      : `token:${hashIdentifier(accessToken)}`;
  }

  const guestToken: string | null = readCookie(cookies, GUEST_SESSION_COOKIE);

  if (guestToken) {
    return `guest:${hashIdentifier(guestToken)}`;
  }

  const deviceId: string | null = readCookie(cookies, DEVICE_COOKIE);

  if (deviceId) {
    return `device:${hashIdentifier(deviceId)}`;
  }

  return `ip:${resolveClientIp(request)}`;
}

/**
 * Идентификатор для троттлинга по адресу клиента.
 */
export function resolveIpTracker(request: Request): string {
  return `ip:${resolveClientIp(request)}`;
}

/**
 * Идентификатор для троттлинга по учётной записи.
 *
 * Перебор пароля ограничивается по конкретному аккаунту, а не по адресу:
 * иначе через общий адрес (Cloudflare, офис, мобильный оператор)
 * один человек блокирует вход всем остальным.
 */
export function resolveAccountTracker(request: Request): string {
  const body: unknown = request.body;
  const email: unknown =
    body !== null && typeof body === 'object'
      ? (body as { email?: unknown }).email
      : undefined;

  if (typeof email === 'string' && email.trim().length > 0) {
    return `account:${hashIdentifier(email.trim().toLowerCase())}`;
  }

  return resolveIpTracker(request);
}

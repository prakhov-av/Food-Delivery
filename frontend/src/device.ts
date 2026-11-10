const DEVICE_COOKIE = 'fd_device';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Идентификатор устройства в обычной (не HttpOnly) cookie.
 *
 * Секретов не содержит: это просто метка браузера, по которой backend
 * считает лимиты. Нужна потому, что адрес клиента за Cloudflare общий
 * у всех посетителей, и лимит на вход в гостевой режим нельзя считать
 * по адресу — иначе один человек исчерпывает лимит всем остальным.
 *
 * Cookie ставится на origin фронта, поэтому работает и на телефоне:
 * сторонние cookie мобильные браузеры блокируют, свои — нет.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  for (const part of document.cookie.split(';')) {
    const separatorIndex: number = part.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    if (part.slice(0, separatorIndex).trim() !== name) {
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

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Возвращает идентификатор устройства, создавая cookie при первом визите.
 */
export function ensureDeviceId(): string {
  const existing: string | null = readCookie(DEVICE_COOKIE);

  if (existing) {
    return existing;
  }

  const id: string = createId();

  document.cookie = `${DEVICE_COOKIE}=${encodeURIComponent(
    id,
  )}; path=/; max-age=${DEVICE_COOKIE_MAX_AGE}; samesite=lax`;

  return id;
}

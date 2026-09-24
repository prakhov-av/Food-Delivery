export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_URL = import.meta.env.VITE_API_URL.replace(/\/$/, '');

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

async function rawRequest(
  path: string,
  options: RequestInit,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  });
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Ошибка ${response.status}`;

  try {
    const body = await response.json();

    if (body?.message) {
      message = Array.isArray(body.message)
        ? body.message.join('; ')
        : body.message;
    }
  } catch {
    // тело не JSON — оставляем сообщение по умолчанию
  }

  return new ApiError(response.status, message);
}

/**
 * Запрос к API.
 * При 401 один раз пробует обновить access-токен
 * через /auth/refresh и повторить запрос.
 */
export async function api<T = void>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !path.startsWith('/auth')) {
    const refreshed = await rawRequest('/auth/refresh', {
      method: 'POST',
    });

    if (refreshed.ok) {
      response = await rawRequest(path, options);
    } else {
      onSessionExpired?.();

      throw new ApiError(401, 'Сессия истекла, войдите заново');
    }
  }

  if (response.status === 401) {
    onSessionExpired?.();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/**
 * GET списка: backend отвечает 404 на пустую таблицу —
 * трактуем 404 как пустой список.
 */
export async function apiList<T>(path: string): Promise<T[]> {
  try {
    return await api<T[]>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return [];
    }

    throw err;
  }
}

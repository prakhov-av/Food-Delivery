export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const NO_REFRESH = ['/auth/login', '/auth/refresh'];

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

async function rawRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const normalizedPath = `/${path.replace(/^\/+/, '')}`;

  // Для FormData Content-Type выставляет сам браузер (multipart + boundary).
  // Ручной application/json сломал бы разбор файла на backend.
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  // Заголовок ставится только когда есть тело.
  // Content-Type: application/json не входит в список "простых" заголовков CORS,
  // поэтому запрос без тела с этим заголовком вызывает preflight OPTIONS
  // перед каждым запросом — вдвое больше круговых обходов.
  const hasBody = options.body !== undefined && options.body !== null;

  return fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    headers: {
      ...(hasBody && !isFormData
        ? { 'Content-Type': 'application/json' }
        : {}),
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
    // тело ответа не JSON, остаётся сообщение по умолчанию
  }

  // Серверная ошибка без конкретной причины не должна показываться пользователю.
  if (response.status >= 500) {
    message = 'Сервер временно недоступен. Попробуйте позже.';
  }

  return new ApiError(response.status, message);
}

export interface ApiOptions extends RequestInit {
  /** Не пытаться обновить токен при 401: нужно для гостевых запросов. */
  skipAuthRefresh?: boolean;
}

export async function api<T = void>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { skipAuthRefresh, ...requestOptions } = options;

  let response = await rawRequest(path, requestOptions);

  if (
    response.status === 401 &&
    !NO_REFRESH.includes(path) &&
    !skipAuthRefresh
  ) {
    const refreshed = await rawRequest('/auth/refresh', {
      method: 'POST',
    });

    if (refreshed.ok) {
      response = await rawRequest(path, requestOptions);
    } else {
      onSessionExpired?.();

      throw new ApiError(401, 'Сессия истекла, войдите заново');
    }
  }

  if (response.status === 401 && !skipAuthRefresh) {
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

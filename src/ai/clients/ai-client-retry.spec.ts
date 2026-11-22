import axios from 'axios';

import { postWithRetry } from './ai-client-retry';

/**
 * Тесты повторов при временных ошибках провайдера.
 *
 * Без повторов лимит запросов к Gemini превращался в 500 на весь ответ:
 * один сбой провайдера ронял загрузку документа и запрос чата.
 */
describe('postWithRetry', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  const httpError = (status: number): Error & { response: { status: number } } =>
    Object.assign(new Error(`HTTP ${status}`), { response: { status } });

  it('should return the response of the first successful attempt', async (): Promise<void> => {
    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { ok: true } } as never);

    const response = await postWithRetry(
      'https://provider.test/generate',
      { prompt: 'hi' },
      { headers: { 'X-Test': '1' } },
      'Test generation',
    );

    expect(response.data).toEqual({ ok: true });
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      'https://provider.test/generate',
      { prompt: 'hi' },
      { headers: { 'X-Test': '1' }, timeout: 120000 },
    );
  });

  it('should retry on 429 and succeed on the next attempt', async (): Promise<void> => {
    const postSpy = jest
      .spyOn(axios, 'post')
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: { ok: true } } as never);

    const response = await postWithRetry(
      'https://provider.test/generate',
      {},
      {},
      'Test generation',
      { retryDelaysMs: [0, 0] },
    );

    expect(response.data).toEqual({ ok: true });
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('should retry on 503 and on a network error without response', async (): Promise<void> => {
    const postSpy = jest
      .spyOn(axios, 'post')
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ data: { ok: true } } as never);

    const response = await postWithRetry(
      'https://provider.test/generate',
      {},
      {},
      'Test generation',
      { retryDelaysMs: [0, 0] },
    );

    expect(response.data).toEqual({ ok: true });
    expect(postSpy).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 400 and should propagate the original error', async (): Promise<void> => {
    const error: Error & { response: { status: number } } = httpError(400);
    const postSpy = jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      postWithRetry('https://provider.test/generate', {}, {}, 'Test generation', {
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toBe(error);

    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('should give up after the last attempt and propagate the error', async (): Promise<void> => {
    const error: Error & { response: { status: number } } = httpError(429);
    const postSpy = jest.spyOn(axios, 'post').mockRejectedValue(error);

    await expect(
      postWithRetry('https://provider.test/generate', {}, {}, 'Test generation', {
        retryDelaysMs: [0, 0],
        maxAttempts: 3,
      }),
    ).rejects.toBe(error);

    expect(postSpy).toHaveBeenCalledTimes(3);
  });

  it('should use the timeout from options', async (): Promise<void> => {
    const postSpy = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { ok: true } } as never);

    await postWithRetry(
      'https://provider.test/generate',
      {},
      {},
      'Test generation',
      { timeoutMs: 5000 },
    );

    expect(postSpy).toHaveBeenCalledWith('https://provider.test/generate', {}, {
      timeout: 5000,
    });
  });
});

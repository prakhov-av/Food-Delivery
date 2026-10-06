import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CsrfMiddleware } from './csrf.middleware';

describe('CsrfMiddleware', (): void => {
  const ORIGINAL_ENV: NodeJS.ProcessEnv = { ...process.env };
  const response = {} as Response;

  // Переменные читаются в полях класса при создании экземпляра,
  // поэтому достаточно выставить env перед `new`.
  const create = (env: Record<string, string | undefined>): CsrfMiddleware => {
    process.env = { ...ORIGINAL_ENV, ...env };

    return new CsrfMiddleware();
  };

  const req = (method: string, origin?: string): Request =>
    ({ method, headers: origin ? { origin } : {} }) as unknown as Request;

  afterEach((): void => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should pass safe methods without origin', (): void => {
    const mw = create({ CORS_ORIGINS: 'http://localhost:5173' });
    const next = jest.fn();

    mw.use(req('GET'), response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass a state-changing request from an allowed origin', (): void => {
    const mw = create({ CORS_ORIGINS: 'http://localhost:5173/' });
    const next = jest.fn();

    mw.use(req('POST', 'http://localhost:5173'), response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject a foreign origin', (): void => {
    const mw = create({ CORS_ORIGINS: 'http://localhost:5173' });

    expect(() =>
      mw.use(req('POST', 'https://evil.example'), response, jest.fn()),
    ).toThrow(ForbiddenException);
  });

  it('should reject a missing origin by default', (): void => {
    const mw = create({
      CORS_ORIGINS: 'http://localhost:5173',
      CSRF_ALLOW_NO_ORIGIN: undefined,
    });

    expect(() => mw.use(req('DELETE'), response, jest.fn())).toThrow(
      ForbiddenException,
    );
  });

  it('should reject everything when CORS_ORIGINS is empty', (): void => {
    const mw = create({ CORS_ORIGINS: '', CSRF_ALLOW_NO_ORIGIN: undefined });

    expect(() =>
      mw.use(req('POST', 'http://localhost:5173'), response, jest.fn()),
    ).toThrow(ForbiddenException);
  });

  it('should allow a missing origin when CSRF_ALLOW_NO_ORIGIN=true', (): void => {
    const mw = create({
      CORS_ORIGINS: 'http://localhost:5173',
      CSRF_ALLOW_NO_ORIGIN: 'true',
    });
    const next = jest.fn();

    mw.use(req('POST'), response, next);

    expect(next).toHaveBeenCalled();
  });
});

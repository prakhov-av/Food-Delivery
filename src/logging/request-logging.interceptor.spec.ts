import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { CallHandler } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  RequestLoggingInterceptor,
  maskSensitive,
} from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let context: ExecutionContext;
  let next: CallHandler;
  let request: Record<string, any>;
  let response: Record<string, any>;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    request = {
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' },
      params: { id: '1' },
      body: { email: 'private@example.com', password: 'super-secret' },
      headers: {
        authorization: 'Bearer jwt-secret',
        cookie: 'refreshToken=refresh-secret',
      },
    };
    response = { statusCode: 200 };
    context = {
      getClass: jest.fn().mockReturnValue(class TestController {}),
      getHandler: jest.fn().mockReturnValue(function testMethod() {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as unknown as ExecutionContext;
    next = { handle: jest.fn() } as unknown as CallHandler;
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('logs safe request metadata without body, headers, or credentials', async () => {
    const debugSpy = jest
      .spyOn((interceptor as any).logger, 'debug')
      .mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1125);
    next.handle = jest.fn().mockReturnValue(of('result'));

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('result');
    expect(debugSpy).toHaveBeenNthCalledWith(
      1,
      'HTTP request started: method=POST, route=/auth/login, handler=TestController.testMethod',
    );
    expect(debugSpy).toHaveBeenNthCalledWith(
      2,
      'HTTP request completed: method=POST, route=/auth/login, handler=TestController.testMethod, status=200, durationMs=125',
    );
    const loggedText = debugSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain('private@example.com');
    expect(loggedText).not.toContain('super-secret');
    expect(loggedText).not.toContain('jwt-secret');
    expect(loggedText).not.toContain('refresh-secret');
  });

  it('masks sensitive fields case-insensitively and recursively', () => {
    expect(
      maskSensitive({
        password: 'secret',
        nested: { refreshToken: 'refresh-secret', safe: 'value' },
        Authorization: 'Bearer secret',
        email: 'private@example.com',
      }),
    ).toEqual({
      password: '***',
      nested: { refreshToken: '***', safe: 'value' },
      Authorization: '***',
      email: '***',
    });
  });

  it('logs request failures without raw exception messages and rethrows them', async () => {
    const warnSpy = jest
      .spyOn((interceptor as any).logger, 'warn')
      .mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValue(2000);
    const error = new HttpException(
      'secret-bearing error message',
      HttpStatus.BAD_REQUEST,
    );
    next.handle = jest.fn().mockReturnValue(throwError(() => error));

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(warnSpy).toHaveBeenCalledWith(
      'HTTP request failed: method=POST, route=/auth/login, handler=TestController.testMethod, status=400, durationMs=0',
    );
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('secret-bearing');
  });

  it('logs unexpected failures at error level', async () => {
    const errorSpy = jest
      .spyOn((interceptor as any).logger, 'error')
      .mockImplementation();
    next.handle = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('private details')));

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('private details');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('status=500'),
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
      'private details',
    );
  });
});

import { ExecutionContext } from '@nestjs/common';
import { CallHandler } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let context: ExecutionContext;
  let next: CallHandler;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();

    context = {
      getClass: jest.fn().mockReturnValue(class TestController {}),
      getHandler: jest.fn().mockReturnValue(function testMethod() {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          params: { id: '1' },
          body: { name: 'test' },
        }),
      }),
    } as unknown as ExecutionContext;

    next = {
      handle: jest.fn(),
    } as unknown as CallHandler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log request and successful response', async () => {
    const debugSpy = jest
      .spyOn((interceptor as any).logger, 'debug')
      .mockImplementation();

    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1125);

    next.handle = jest.fn().mockReturnValue(of('result'));

    const observable = interceptor.intercept(context, next);
    const result = await lastValueFrom(observable as any);

    expect(result).toBe('result');
    expect(next.handle).toHaveBeenCalled();

    expect(debugSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'TestController.testMethod called with params: {"id":"1"} and body: {"name":"test"}',
      ),
    );

    expect(debugSpy).toHaveBeenNthCalledWith(
      2,
      'TestController.testMethod returned result in 125 ms',
    );
  });

  it('should log none when request body is absent', async () => {
    const debugSpy = jest
      .spyOn((interceptor as any).logger, 'debug')
      .mockImplementation();

    jest.spyOn(Date, 'now').mockReturnValue(1000);

    context = {
      getClass: jest.fn().mockReturnValue(class TestController {}),
      getHandler: jest.fn().mockReturnValue(function testMethod() {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          params: {},
        }),
      }),
    } as unknown as ExecutionContext;

    next.handle = jest.fn().mockReturnValue(of('ok'));

    await lastValueFrom(interceptor.intercept(context, next) as any);

    expect(debugSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('body: none'),
    );
  });

  it('should log errors and rethrow them', async () => {
    const warnSpy = jest
      .spyOn((interceptor as any).logger, 'warn')
      .mockImplementation();

    jest.spyOn(Date, 'now').mockImplementation(() => 2000);

    const error = new Error('request failed');

    next.handle = jest.fn().mockReturnValue(throwError(() => error));

    await expect(
      lastValueFrom(interceptor.intercept(context, next) as any),
    ).rejects.toBe(error);

    expect(warnSpy).toHaveBeenCalledWith(
      'TestController.testMethod threw error: request failed in 0 ms',
    );
  });
});

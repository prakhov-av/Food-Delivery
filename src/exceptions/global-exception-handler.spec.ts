import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionHandler } from './global-exception-handler';

describe('GlobalExceptionHandler', () => {
  let handler: GlobalExceptionHandler;
  let response: any;
  let request: any;
  let host: any;

  beforeEach(() => {
    handler = new GlobalExceptionHandler();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    request = { url: '/api/test' };
    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    };
  });

  it('should handle HttpException with its status and message', () => {
    const warnSpy = jest.spyOn((handler as any).logger, 'warn').mockImplementation();
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

    handler.catch(exception, host);

    expect(warnSpy).toHaveBeenCalledWith('Bad request');
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/test',
        status: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should handle non-HttpException as internal server error', () => {
    const errorSpy = jest.spyOn((handler as any).logger, 'error').mockImplementation();
    const exception = new Error('database failure');

    handler.catch(exception, host);

    expect(errorSpy).toHaveBeenCalledWith(exception.stack);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/test',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
      }),
    );
  });
});

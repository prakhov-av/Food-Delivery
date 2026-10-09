import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionHandler } from './global-exception-handler';

describe('GlobalExceptionHandler', () => {
  let handler: GlobalExceptionHandler;
  let response: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let request: {
    url: string;
    path: string;
    method: string;
    route?: { path: string };
  };
  let host: {
    switchToHttp: jest.Mock;
  };

  beforeEach(() => {
    handler = new GlobalExceptionHandler();

    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    request = {
      url: '/api/test',
      path: '/api/test',
      method: 'POST',
    };

    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    };
  });

  it('should handle HttpException with its status and message', () => {
    const warnSpy = jest
      .spyOn((handler as any).logger, 'warn')
      .mockImplementation();

    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

    handler.catch(exception, host as any);

    expect(warnSpy).toHaveBeenCalledWith(
      'HTTP exception: method=POST, status=400',
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.BAD_REQUEST,
      message: 'Bad request',
    });
  });

  it('should return detailed validation messages instead of a generic message', () => {
    const exception = new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: [
          'email must be an email',
          'password must be longer than or equal to 8 characters',
        ],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    handler.catch(exception, host as any);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.BAD_REQUEST,
      message:
        'email must be an email; password must be longer than or equal to 8 characters',
    });
  });

  it('should handle a string returned by getResponse()', () => {
    const exception = new HttpException(
      'Resource not found',
      HttpStatus.NOT_FOUND,
    );

    handler.catch(exception, host as any);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.NOT_FOUND,
      message: 'Resource not found',
    });
  });

  it('should handle an object response containing a string message', () => {
    const exception = new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: 'Conflict',
      },
      HttpStatus.CONFLICT,
    );

    handler.catch(exception, host as any);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.CONFLICT,
      message: 'Resource already exists',
    });
  });

  it('should use the exception message when the response has no message', () => {
    const exception = new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    handler.catch(exception, host as any);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HttpStatus.BAD_REQUEST,
        message: exception.message,
      }),
    );
  });

  it('should hide internal details for unexpected errors', () => {
    const errorSpy = jest
      .spyOn((handler as any).logger, 'error')
      .mockImplementation();

    const exception = new Error(
      'database failure: internal connection details',
    );

    handler.catch(exception, host as any);

    expect(errorSpy).toHaveBeenCalledWith(
      'Unhandled exception: method=POST, status=500, errorType=Error',
    );
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });

    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'database failure',
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'internal connection details',
    );
  });

  it('should handle non-Error thrown values without exposing them', () => {
    const errorSpy = jest
      .spyOn((handler as any).logger, 'error')
      .mockImplementation();

    handler.catch('sensitive internal information', host as any);

    expect(errorSpy).toHaveBeenCalledWith(
      'Unhandled exception: method=POST, status=500, errorType=Error',
    );

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    expect(response.json).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      path: '/api/test',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });

    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'sensitive internal information',
    );
  });
});

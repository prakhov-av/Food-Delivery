import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

/**
 * Преобразует необработанные исключения в согласованные HTTP-ответы API.
 *
 * Для HTTP-исключений сохраняет соответствующий статус и информативное
 * сообщение. Для неожиданных ошибок возвращает обобщённое сообщение,
 * не раскрывая внутренние детали реализации.
 *
 * Поле path содержит фактический путь HTTP-запроса, а не шаблон маршрута.
 */
@Catch()
export class GlobalExceptionHandler implements ExceptionFilter {
  private readonly logger: Logger = new Logger(GlobalExceptionHandler.name);

  /**
   * Обрабатывает исключение и формирует единообразный JSON-ответ.
   *
   * @param exception Перехваченное исключение.
   * @param host Контекст выполнения HTTP-запроса.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context: HttpArgumentsHost = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.getExceptionMessage(exception);

      this.logger.warn(
        `HTTP exception: method=${request.method ?? 'unknown'}, status=${status}`,
      );
    } else {
      const error: Error =
        exception instanceof Error
          ? exception
          : new Error('Unknown internal error');

      this.logger.error(
        `Unhandled exception: method=${request.method ?? 'unknown'}, status=${status}, errorType=${error.name}`,
      );
    }

    response.status(status).json({
      timestamp: new Date().toISOString(),
      path: request.path ?? '/',
      status,
      message,
    });
  }

  /**
   * Извлекает безопасное и информативное сообщение из HTTP-исключения.
   *
   * Если исключение содержит массив строк, сообщения объединяются
   * через точку с запятой. При отсутствии подходящего поля используется
   * стандартное сообщение исключения.
   *
   * @param exception HTTP-исключение NestJS.
   * @returns Сообщение для тела HTTP-ответа.
   */
  private getExceptionMessage(exception: HttpException): string {
    const exceptionResponse: string | object = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message: unknown = exceptionResponse.message;

      if (typeof message === 'string') {
        return message;
      }

      if (
        Array.isArray(message) &&
        message.every((item: unknown) => typeof item === 'string')
      ) {
        return message.join('; ');
      }
    }

    return exception.message;
  }
}
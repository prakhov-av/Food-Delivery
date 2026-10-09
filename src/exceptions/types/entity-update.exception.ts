import { HttpException, HttpStatus } from '@nestjs/common';

/**
   * Определяет типизированную структуру «EntityUpdateException», используемую при обмене данными между компонентами.
   */
export class EntityUpdateException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

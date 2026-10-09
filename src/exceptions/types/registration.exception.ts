import { HttpException, HttpStatus } from '@nestjs/common';

/**
   * Определяет типизированную структуру «RegistrationException», используемую при обмене данными между компонентами.
   */
export class RegistrationException extends HttpException{
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

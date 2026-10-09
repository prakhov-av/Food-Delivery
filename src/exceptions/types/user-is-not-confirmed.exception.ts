import { HttpException, HttpStatus } from '@nestjs/common';

/**
   * Определяет типизированную структуру «UserIsNotConfirmedException», используемую при обмене данными между компонентами.
   */
export class UserIsNotConfirmedException extends HttpException {
  constructor(email: string) {
    super(`User with email ${email} is not confirmed`, HttpStatus.FORBIDDEN);
  }
}

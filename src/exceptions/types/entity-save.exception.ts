import { HttpException, HttpStatus } from '@nestjs/common';

/**
   * Определяет типизированную структуру «EntitySaveException», используемую при обмене данными между компонентами.
   */
export class EntitySaveException extends HttpException {
  constructor(entityTitle: string, fieldTitle: string) {
    super(
      `${entityTitle} save error: this ${fieldTitle} already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

/**
   * Определяет типизированную структуру «UnsupportedFileFormatException», используемую при обмене данными между компонентами.
   */
export class UnsupportedFileFormatException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

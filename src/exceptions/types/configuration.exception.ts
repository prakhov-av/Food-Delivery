import { InternalServerErrorException } from '@nestjs/common';

/**
   * Определяет типизированную структуру «ConfigurationException», используемую при обмене данными между компонентами.
   */
export class ConfigurationException extends InternalServerErrorException {
  constructor(message: string) {
    super(message);
  }
}

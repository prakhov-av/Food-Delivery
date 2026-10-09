import { Module } from '@nestjs/common';
import { PromptService } from './prompt.service';

@Module({
  providers: [PromptService],
  exports: [PromptService],
})
/**
   * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
   */
export class PromptsModule {}

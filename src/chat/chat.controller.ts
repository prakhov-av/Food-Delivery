import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiChatRequestDto } from './dto/ai-chat-request.dto';
import { ChatService } from './chat.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

/**
   * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
   */
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  // Каждый вызов это эмбеддинг и запрос к LLM, поэтому лимит строже общего.
  // includeBody: false, текст вопросов в журнал не пишется.
  @Audit({
    action: AuditAction.CHAT_QUERY,
    entityType: 'Chat',
    includeBody: false,
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async askAi(
    @Body() chatRequestDto: AiChatRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<string> {
    return this.service.generateResponse(
      chatRequestDto.message,
      request.user.id,
      request.user.role,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  clearHistory(@Req() request: AuthenticatedRequest): void {
    this.service.clearHistory(request.user.id);
  }
}

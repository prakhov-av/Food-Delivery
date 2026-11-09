import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiChatRequestDto } from './dto/ai-chat-request.dto';
import { ChatService } from './chat.service';
import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';
import { ChatHistoryItemDto } from './dto/chat-history-item.dto';
import type { ChatIdentityRequest } from './types/chat-identity-request';
import { ChatIdentityGuard } from './chat-identity.guard';
import { Public } from '../auth/types/auth.decorators';

/** HTTP API AI-чата для зарегистрированных пользователей и гостевых сессий. */
@Public()
@UseGuards(ChatIdentityGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Audit({
    action: AuditAction.CHAT_QUERY,
    entityType: 'Chat',
    includeBody: false,
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  async askAi(
    @Body() chatRequestDto: AiChatRequestDto,
    @Req() request: ChatIdentityRequest,
  ): Promise<string> {
    return this.service.generateResponseForIdentity(
      chatRequestDto.message,
      request.chatIdentity,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearHistory(@Req() request: ChatIdentityRequest): void {
    this.service.clearHistoryForIdentity(request.chatIdentity);
  }

  @Get('history')
  async getHistory(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Req() request: ChatIdentityRequest,
  ): Promise<ChatHistoryItemDto[]> {
    return this.service.getHistoryForIdentity(request.chatIdentity, limit);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearStoredHistory(@Req() request: ChatIdentityRequest): Promise<void> {
    await this.service.clearStoredHistoryForIdentity(request.chatIdentity);
  }
}

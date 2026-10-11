import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { ChatLog } from './chat-log.entity';
import { ChatLogKind } from './enums/chat-log-kind.enum';
import { ChatMessage } from './types/chat-message';

const DAY_MS: number = 24 * 60 * 60 * 1000;
const RETENTION_DAYS: number =
  Number(process.env.CHAT_HISTORY_RETENTION_DAYS) || 30;

export interface ChatLogEntry {
  userId: number;
  userRole: string;
  question: string;
  answer: string | null;
  kind: ChatLogKind;
  documentType: string | null;
  chunksFound: number | null;
}

/**
 * Хранит переписку пользователя с ассистентом. Сбой чтения или записи
 * не ломает ответ чата (по образцу AuditService).
 */
@Injectable()
export class ChatLogService {
  private readonly logger: Logger = new Logger(ChatLogService.name);

  constructor(
    @InjectRepository(ChatLog)
    private readonly repository: Repository<ChatLog>,
  ) {}

  async record(entry: ChatLogEntry): Promise<void> {
    try {
      await this.repository.save(this.repository.create(entry));

      await this.repository.delete({
        userId: entry.userId,
        createdAt: LessThan(this.cutoff()),
      });
    } catch (error) {
      this.logger.error(
        `Failed to write chat log: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Последние записи пользователя, от старых к новым. */
  async findRecent(userId: number, limit: number): Promise<ChatLog[]> {
    const logs: ChatLog[] = await this.repository.find({
      where: { userId, createdAt: MoreThanOrEqual(this.cutoff()) },
      order: { id: 'DESC' },
      take: limit,
    });

    return logs.reverse();
  }

  /** Окно для модели: только пары, у которых сохранён ответ. */
  async getWindow(userId: number, limit: number): Promise<ChatMessage[]> {
    try {
      const logs: ChatLog[] = await this.repository.find({
        where: {
          userId,
          answer: Not(IsNull()),
          createdAt: MoreThanOrEqual(this.cutoff()),
        },
        order: { id: 'DESC' },
        take: limit,
      });

      return logs.reverse().map((log: ChatLog): ChatMessage => {
        const message: ChatMessage = new ChatMessage();
        message.userRequest = log.question;
        message.aiAnswer = log.answer ?? '';

        return message;
      });
    } catch (error) {
      this.logger.error(
        `Failed to load chat window: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return [];
    }
  }

  async deleteByUserId(userId: number): Promise<void> {
    await this.repository.delete({ userId });
  }

  private cutoff(): Date {
    return new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  }
}

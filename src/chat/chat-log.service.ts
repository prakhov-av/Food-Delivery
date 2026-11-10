import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { ChatLog } from './chat-log.entity';
import { ChatLogKind } from './enums/chat-log-kind.enum';
import { ChatMessage } from './types/chat-message';
import { ChatOwner } from './types/chat-identity';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = Number(process.env.CHAT_HISTORY_RETENTION_DAYS) || 30;

export type ChatLogEntry = ChatOwner & {
  userRole: string;
  question: string;
  answer: string | null;
  kind: ChatLogKind;
  documentType: string | null;
  chunksFound: number | null;
};

@Injectable()
export class ChatLogService {
  private readonly logger = new Logger(ChatLogService.name);

  constructor(
    @InjectRepository(ChatLog)
    private readonly repository: Repository<ChatLog>,
  ) {}

  async record(entry: ChatLogEntry): Promise<void> {
    try {
      const ownerWhere = this.ownerWhere(entry);
      await this.repository.save(this.repository.create(entry));
      await this.repository.delete({
        ...ownerWhere,
        createdAt: LessThan(this.cutoff()),
      });
    } catch (error) {
      this.logger.error(`Failed to write chat log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async findRecent(userId: number, limit: number): Promise<ChatLog[]> {
    return this.findRecentByOwner({ userId }, limit);
  }

  async findRecentByGuestSessionId(guestSessionId: string, limit: number): Promise<ChatLog[]> {
    return this.findRecentByOwner({ guestSessionId }, limit);
  }

  private async findRecentByOwner(owner: ChatOwner, limit: number): Promise<ChatLog[]> {
    const logs = await this.repository.find({
      where: { ...this.ownerWhere(owner), createdAt: MoreThanOrEqual(this.cutoff()) },
      order: { id: 'DESC' },
      take: limit,
    });
    return logs.reverse();
  }

  async getWindow(userId: number, limit: number): Promise<ChatMessage[]> {
    return this.getWindowByOwner({ userId }, limit);
  }

  async getWindowByGuestSessionId(guestSessionId: string, limit: number): Promise<ChatMessage[]> {
    return this.getWindowByOwner({ guestSessionId }, limit);
  }

  private async getWindowByOwner(owner: ChatOwner, limit: number): Promise<ChatMessage[]> {
    try {
      const logs = await this.repository.find({
        where: {
          ...this.ownerWhere(owner),
          answer: Not(IsNull()),
          createdAt: MoreThanOrEqual(this.cutoff()),
        },
        order: { id: 'DESC' },
        take: limit,
      });
      return logs.reverse().map((log) => {
        const message = new ChatMessage();
        message.userRequest = log.question;
        message.aiAnswer = log.answer ?? '';
        return message;
      });
    } catch (error) {
      this.logger.error(`Failed to load chat window: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteByUserId(userId: number): Promise<void> {
    await this.repository.delete({ userId });
  }

  async deleteByGuestSessionId(guestSessionId: string): Promise<void> {
    await this.repository.delete({ guestSessionId });
  }

  private ownerWhere(owner: ChatOwner): { userId: number } | { guestSessionId: string } {
    if (owner.userId !== undefined) return { userId: owner.userId };
    return { guestSessionId: owner.guestSessionId! };
  }

  private cutoff(): Date {
    return new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  }
}

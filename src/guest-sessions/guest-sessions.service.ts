import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { GuestSession } from './guest-session.entity';
import { DEFAULT_GUEST_SESSION_TTL_DAYS } from './guest-session.constants';

/**
 * Управляет жизненным циклом гостевых сессий.
 *
 * Секретный токен передаётся только через HttpOnly cookie.
 * В базе данных хранится исключительно SHA-256-хеш токена.
 */
@Injectable()
export class GuestSessionsService {
  private readonly ttlDays: number;

  constructor(
    @InjectRepository(GuestSession)
    private readonly repository: Repository<GuestSession>,
    private readonly configService: ConfigService,
  ) {
    const configuredTtl = Number(
      this.configService.get<string>('GUEST_SESSION_TTL_DAYS'),
    );

    this.ttlDays =
      Number.isInteger(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_GUEST_SESSION_TTL_DAYS;
  }

  /**
   * Создаёт новую гостевую сессию.
   *
   * Возвращает исходный токен только вызывающему контроллеру,
   * чтобы тот мог установить его в HttpOnly cookie.
   */
  async createSession(): Promise<{
    guestSession: GuestSession;
    token: string;
  }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.ttlDays);

    const guestSession = this.repository.create({
      tokenHash,
      expiresAt,
    });

    const savedSession = await this.repository.save(guestSession);

    return {
      guestSession: savedSession,
      token,
    };
  }

  /**
   * Проверяет токен и возвращает действующую гостевую сессию.
   *
   * При успешной проверке обновляет время последней активности.
   */
  async resolveSession(token: string): Promise<GuestSession> {
    if (!token) {
      throw new UnauthorizedException('Guest session is required');
    }

    const tokenHash = this.hashToken(token);

    const guestSession = await this.repository.findOne({
      where: { tokenHash },
    });

    if (
      !guestSession ||
      (guestSession.expiresAt !== null &&
        guestSession.expiresAt.getTime() <= Date.now())
    ) {
      throw new UnauthorizedException('Guest session is invalid or expired');
    }

    const now = new Date();

    await this.repository.update(guestSession.id, {
      lastActivityAt: now,
    });

    guestSession.lastActivityAt = now;

    return guestSession;
  }

  /**
   * Отзывает гостевую сессию, не удаляя её из базы данных.
   *
   * Это важно, поскольку гостевые заказы ссылаются на запись
   * гостевой сессии через внешний ключ.
   */
  async revokeSession(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = this.hashToken(token);

    const guestSession = await this.repository.findOne({
      where: { tokenHash },
    });

    if (!guestSession) {
      return;
    }

    await this.repository.update(guestSession.id, {
      expiresAt: new Date(),
    });
  }

  /**
   * Возвращает срок действия cookie в миллисекундах.
   */
  getCookieMaxAge(): number {
    return this.ttlDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Вычисляет SHA-256-хеш секретного токена.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { GuestSession } from './guest-session.entity';
import { DEFAULT_GUEST_SESSION_TTL_DAYS } from './guest-session.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GUEST_SESSION_RETENTION_DAYS = 30;

/**
 * Управляет жизненным циклом гостевых сессий.
 *
 * Секретный токен передаётся только через HttpOnly cookie.
 * В базе данных хранится исключительно SHA-256-хеш токена.
 */
@Injectable()
export class GuestSessionsService {
  private readonly logger: Logger = new Logger(GuestSessionsService.name);
  private readonly ttlDays: number;
  private readonly retentionDays: number;

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

    const configuredRetention = Number(
      this.configService.get<string>('GUEST_SESSION_RETENTION_DAYS'),
    );

    this.retentionDays =
      Number.isInteger(configuredRetention) && configuredRetention > 0
        ? configuredRetention
        : DEFAULT_GUEST_SESSION_RETENTION_DAYS;
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

    /**
     * Уборка просроченных сессий выполняется при создании новой.
     * Это тот же приём, что и в ChatLogService: никакого планировщика,
     * чистка происходит тогда, когда таблица реально растёт.
     */
    await this.deleteExpiredSessions();

    return {
      guestSession: savedSession,
      token,
    };
  }

  /**
   * Удаляет гостевые сессии, у которых истёк срок давности.
   *
   * Заказы и позиции гостя удаляются каскадом на уровне базы данных:
   * внешний ключ orders.guest_session_id объявлен с ON DELETE CASCADE.
   *
   * @returns Количество удалённых сессий.
   */
  async deleteExpiredSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);

    try {
      const result = await this.repository.delete({
        expiresAt: LessThan(cutoff),
      });

      const affected: number = result.affected ?? 0;

      if (affected > 0) {
        this.logger.log(
          `Expired guest sessions removed: ${affected}, ` +
            `retention ${this.retentionDays} days`,
        );
      }

      return affected;
    } catch (error) {
      this.logger.error(
        `Failed to remove expired guest sessions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return 0;
    }
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

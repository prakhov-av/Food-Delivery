import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

import { GuestSessionsService } from './guest-sessions.service';
import { GuestSession } from './guest-session.entity';

describe('GuestSessionsService', (): void => {
  let service: GuestSessionsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const DAY_MS = 24 * 60 * 60 * 1000;

  const hashOf = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

  beforeEach((): void => {
    repository = {
      create: jest.fn((data: Partial<GuestSession>): GuestSession =>
        data as GuestSession,
      ),
      save: jest.fn(
        async (session: GuestSession): Promise<GuestSession> => session,
      ),
      findOne: jest.fn(),
      update: jest.fn(async (): Promise<void> => undefined),
      delete: jest.fn(async (): Promise<{ affected: number }> => ({
        affected: 0,
      })),
    };

    configService = {
      get: jest.fn(),
    };

    service = new GuestSessionsService(
      repository as never,
      configService as never,
    );
  });

  describe('createSession', (): void => {
    it('should store only the hash of the token', async (): Promise<void> => {
      const { guestSession, token } = await service.createSession();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(guestSession.tokenHash).toBe(hashOf(token));
      expect(guestSession.tokenHash).not.toBe(token);
    });

    it('should set the expiration date from the configured lifetime', async (): Promise<void> => {
      configService.get.mockImplementation((key: string) =>
        key === 'GUEST_SESSION_TTL_DAYS' ? '7' : undefined,
      );

      service = new GuestSessionsService(
        repository as never,
        configService as never,
      );

      const before = Date.now();
      const { guestSession } = await service.createSession();

      const expiresAt = guestSession.expiresAt!.getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
    });

    it('should remove expired sessions after creating a new one', async (): Promise<void> => {
      await service.createSession();

      expect(repository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveSession', (): void => {
    it('should resolve a valid token and refresh the activity time', async (): Promise<void> => {
      const token = 'a'.repeat(64);
      const session: GuestSession = {
        id: 'session-id',
        tokenHash: hashOf(token),
        expiresAt: new Date(Date.now() + DAY_MS),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        orders: [],
      };

      repository.findOne.mockResolvedValue(session);

      const resolved = await service.resolveSession(token);

      expect(resolved).toBe(session);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { tokenHash: hashOf(token) },
      });
      expect(repository.update).toHaveBeenCalledWith(
        'session-id',
        expect.objectContaining({ lastActivityAt: expect.any(Date) }),
      );
    });

    it('should reject an unknown token', async (): Promise<void> => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.resolveSession('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should reject an expired session', async (): Promise<void> => {
      repository.findOne.mockResolvedValue({
        id: 'session-id',
        tokenHash: hashOf('expired'),
        expiresAt: new Date(Date.now() - DAY_MS),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        orders: [],
      } as GuestSession);

      await expect(
        service.resolveSession('expired'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject an empty token', async (): Promise<void> => {
      await expect(service.resolveSession('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', (): void => {
    it('should expire the session but keep its row', async (): Promise<void> => {
      const token = 'b'.repeat(64);

      repository.findOne.mockResolvedValue({
        id: 'session-id',
        tokenHash: hashOf(token),
        expiresAt: new Date(Date.now() + DAY_MS),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        orders: [],
      } as GuestSession);

      await service.revokeSession(token);

      expect(repository.update).toHaveBeenCalledWith(
        'session-id',
        expect.objectContaining({ expiresAt: expect.any(Date) }),
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('should do nothing when the session is unknown', async (): Promise<void> => {
      repository.findOne.mockResolvedValue(null);

      await service.revokeSession('unknown');

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpiredSessions', (): void => {
    it('should delete sessions that expired before the retention cutoff', async (): Promise<void> => {
      repository.delete.mockResolvedValue({ affected: 3 });

      const affected = await service.deleteExpiredSessions();

      expect(affected).toBe(3);

      const criteria = repository.delete.mock.calls[0][0] as {
        expiresAt: { value: Date };
      };

      expect(criteria.expiresAt.value.getTime()).toBeLessThan(Date.now());
    });

    it('should keep sessions that are still alive', async (): Promise<void> => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await service.deleteExpiredSessions();

      const criteria = repository.delete.mock.calls[0][0] as {
        expiresAt: { value: Date };
      };

      const daysAgo: number =
        (Date.now() - criteria.expiresAt.value.getTime()) / DAY_MS;

      expect(daysAgo).toBeGreaterThanOrEqual(29);
      expect(daysAgo).toBeLessThanOrEqual(31);
    });

    it('should not break the request when the cleanup fails', async (): Promise<void> => {
      repository.delete.mockRejectedValue(new Error('database is down'));

      await expect(service.deleteExpiredSessions()).resolves.toBe(0);
    });
  });
});

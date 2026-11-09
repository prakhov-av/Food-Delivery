import { UnauthorizedException } from '@nestjs/common';
import { ChatIdentityGuard } from './chat-identity.guard';
import { Role } from '../users/enums/role.enum';

describe('ChatIdentityGuard', () => {
  const tokensService = {
    getTokenFromCookies: jest.fn(),
    validateAccessTokenAndGetEmail: jest.fn(),
  };

  const usersService = {
    getConfirmedByEmail: jest.fn(),
  };

  const guestSessionsService = {
    resolveSession: jest.fn(),
  };

  let guard: ChatIdentityGuard;

  beforeEach(() => {
    jest.resetAllMocks();

    tokensService.getTokenFromCookies.mockImplementation(
      (cookieHeader: string | undefined, cookieName: string) => {
        if (!cookieHeader) {
          return null;
        }

        const cookie = cookieHeader
          .split('; ')
          .find((item) => item.startsWith(`${cookieName}=`));

        return cookie ? cookie.split('=', 2)[1] : null;
      },
    );

    guard = new ChatIdentityGuard(
      tokensService as any,
      usersService as any,
      guestSessionsService as any,
    );
  });

  it('resolves a registered user from access-token cookie', async () => {
    tokensService.validateAccessTokenAndGetEmail.mockReturnValue(
      'user@example.com',
    );

    const user = {
      id: 17,
      role: Role.CUSTOMER,
    };

    usersService.getConfirmedByEmail.mockResolvedValue(user);

    const request: any = {
      headers: {
        cookie: 'access-token=access-token-value',
      },
    };

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as any),
    ).resolves.toBe(true);

    expect(request.user).toBe(user);

    expect(request.chatIdentity).toEqual({
      kind: 'user',
      userId: 17,
      role: Role.CUSTOMER,
    });

    expect(guestSessionsService.resolveSession).not.toHaveBeenCalled();
  });

  it('resolves a guest from guest-session cookie', async () => {
    guestSessionsService.resolveSession.mockResolvedValue({
      id: 'guest-uuid',
    });

    const request: any = {
      headers: {
        cookie: 'guest-session=guest-token-value',
      },
    };

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as any),
    ).resolves.toBe(true);

    expect(request.chatIdentity).toEqual({
      kind: 'guest',
      guestSessionId: 'guest-uuid',
      role: Role.CUSTOMER,
    });

    expect(guestSessionsService.resolveSession).toHaveBeenCalledWith(
      'guest-token-value',
    );
  });

  it('rejects requests without either identity cookie', async () => {
    const request: any = {
      headers: {},
    };

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(guestSessionsService.resolveSession).not.toHaveBeenCalled();
    expect(usersService.getConfirmedByEmail).not.toHaveBeenCalled();
  });

  it('does not downgrade an invalid access token to a guest session', async () => {
    tokensService.validateAccessTokenAndGetEmail.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    const request: any = {
      headers: {
        cookie: 'access-token=invalid; guest-session=valid',
      },
    };

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(guestSessionsService.resolveSession).not.toHaveBeenCalled();
  });
});

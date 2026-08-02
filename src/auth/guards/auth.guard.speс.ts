import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from './auth.guard';
import { TokensService } from '../tokens.service';
import { UsersService } from '../../users/users.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const tokensServiceMock = {
    getTokenFromCookies: jest.fn(),
    validateAccessTokenAndGetEmail: jest.fn(),
  };

  const usersServiceMock = {
    getConfirmedByEmail: jest.fn(),
  };

  let request: any;
  let context: ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    request = {
      headers: {},
    };

    context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: Reflector,
          useValue: reflectorMock,
        },
        {
          provide: TokensService,
          useValue: tokensServiceMock,
        },
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    guard = module.get(AuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow public endpoint', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);

    expect(reflectorMock.getAllAndOverride).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when access token is missing', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);

    request.headers.cookie = undefined;

    tokensServiceMock.getTokenFromCookies.mockReturnValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(tokensServiceMock.getTokenFromCookies).toHaveBeenCalledWith(
      undefined,
      'access-token',
    );
  });

  it('should authenticate user', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
    };

    reflectorMock.getAllAndOverride.mockReturnValue(false);

    request.headers.cookie = 'access-token=token';

    tokensServiceMock.getTokenFromCookies.mockReturnValue('token');

    tokensServiceMock.validateAccessTokenAndGetEmail.mockReturnValue(
      'test@test.com',
    );

    usersServiceMock.getConfirmedByEmail.mockResolvedValue(user);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);

    expect(request.user).toEqual(user);

    expect(usersServiceMock.getConfirmedByEmail).toHaveBeenCalledWith(
      'test@test.com',
    );
  });
});

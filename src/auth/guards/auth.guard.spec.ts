import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { TokensService } from '../tokens.service';
import { UsersService } from '../../users/users.service';
import { Role } from '../../users/enums/role.enum';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const reflectorMock = { getAllAndOverride: jest.fn() };
  const tokensServiceMock = {
    getTokenFromCookies: jest.fn(),
    validateAccessTokenAndGetEmail: jest.fn(),
  };
  const usersServiceMock = { getConfirmedByEmail: jest.fn() };

  let request: any;
  let context: ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    request = { headers: {} };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: TokensService, useValue: tokensServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow public endpoint without reading authentication data', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(tokensServiceMock.getTokenFromCookies).not.toHaveBeenCalled();
    expect(usersServiceMock.getConfirmedByEmail).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when access token is missing', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    tokensServiceMock.getTokenFromCookies.mockReturnValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tokensServiceMock.getTokenFromCookies).toHaveBeenCalledWith(
      undefined,
      'access-token',
    );
  });

  it('should validate token, load confirmed user and attach it to request', async () => {
    const user = { id: 1, email: 'user@test.com', role: Role.CUSTOMER };
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    request.headers.cookie = 'access-token=token';
    tokensServiceMock.getTokenFromCookies.mockReturnValue('token');
    tokensServiceMock.validateAccessTokenAndGetEmail.mockReturnValue(
      'user@test.com',
    );
    usersServiceMock.getConfirmedByEmail.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(tokensServiceMock.validateAccessTokenAndGetEmail).toHaveBeenCalledWith(
      'token',
    );
    expect(usersServiceMock.getConfirmedByEmail).toHaveBeenCalledWith(
      'user@test.com',
    );
    expect(request.user).toBe(user);
  });

  it('should propagate invalid access token error', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    tokensServiceMock.getTokenFromCookies.mockReturnValue('bad-token');
    tokensServiceMock.validateAccessTokenAndGetEmail.mockImplementation(() => {
      throw new UnauthorizedException('Invalid access token');
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersServiceMock.getConfirmedByEmail).not.toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TokensService } from './tokens.service';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    getConfirmedByEmail: jest.fn(),
  };

  const tokensServiceMock = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    validateRefreshTokenAndGetEmail: jest.fn(),
    getTokenFromCookies: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: TokensService,
          useValue: tokensServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return authenticated user when credentials are valid', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
      password: 'hashed-password',
    };

    usersServiceMock.getConfirmedByEmail.mockResolvedValue(user);

    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

    const result = await service.getAuthenticatedUser(
      'test@test.com',
      'plain-password',
    );

    expect(usersServiceMock.getConfirmedByEmail).toHaveBeenCalledWith(
      'test@test.com',
    );

    expect(result).toBe(user);
  });

  it('should throw UnauthorizedException when password is incorrect', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
      password: 'hashed-password',
    };

    usersServiceMock.getConfirmedByEmail.mockResolvedValue(user);

    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

    await expect(
      service.getAuthenticatedUser('test@test.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersServiceMock.getConfirmedByEmail).toHaveBeenCalledWith(
      'test@test.com',
    );
  });

  it('should return access token and refresh token', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
      role: 'CLIENT',
    };

    jest.spyOn(service, 'getAuthenticatedUser').mockResolvedValue(user as any);

    tokensServiceMock.generateAccessToken.mockReturnValue('access-token');

    tokensServiceMock.generateRefreshToken.mockReturnValue('refresh-token');

    const result = await service.login({
      email: 'test@test.com',
      password: 'password',
    });

    expect(service.getAuthenticatedUser).toHaveBeenCalledWith(
      'test@test.com',
      'password',
    );

    expect(tokensServiceMock.generateAccessToken).toHaveBeenCalledWith(user);

    expect(tokensServiceMock.generateRefreshToken).toHaveBeenCalledWith(user);

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('should throw UnauthorizedException when cookies are undefined', async () => {
    await expect(service.refreshAccessToken(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when refresh token cookie is missing', async () => {
    tokensServiceMock.getTokenFromCookies.mockReturnValue(null);

    await expect(service.refreshAccessToken('some-cookie')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(tokensServiceMock.getTokenFromCookies).toHaveBeenCalledWith(
      'some-cookie',
      'refresh-token',
    );
  });

  it('should throw UnauthorizedException when cookies are undefined', async () => {
    await expect(service.refreshAccessToken(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when refresh token cookie is missing', async () => {
    tokensServiceMock.getTokenFromCookies.mockReturnValue(null);

    await expect(service.refreshAccessToken('some-cookie')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(tokensServiceMock.getTokenFromCookies).toHaveBeenCalledWith(
      'some-cookie',
      'refresh-token',
    );
  });

  it('should throw UnauthorizedException when refresh token is not stored', async () => {
    tokensServiceMock.getTokenFromCookies.mockReturnValue('refresh-token');

    tokensServiceMock.validateRefreshTokenAndGetEmail.mockReturnValue(
      'test@test.com',
    );

    await expect(
      service.refreshAccessToken('refresh-token=refresh-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return new access token when refresh token is valid', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
      role: 'CLIENT',
    };

    jest.spyOn(service, 'getAuthenticatedUser').mockResolvedValue(user as any);

    tokensServiceMock.generateAccessToken
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('new-access-token');

    tokensServiceMock.generateRefreshToken.mockReturnValue('refresh-token');

    await service.login({
      email: 'test@test.com',
      password: 'password',
    });

    tokensServiceMock.getTokenFromCookies.mockReturnValue('refresh-token');

    tokensServiceMock.validateRefreshTokenAndGetEmail.mockReturnValue(
      'test@test.com',
    );

    usersServiceMock.getConfirmedByEmail.mockResolvedValue(user);

    const result = await service.refreshAccessToken(
      'refresh-token=refresh-token',
    );

    expect(result).toBe('new-access-token');

    expect(tokensServiceMock.generateAccessToken).toHaveBeenLastCalledWith(
      user,
    );
  });

  it('should ignore undefined cookies when revoking refresh token', () => {
    expect(() => service.revokeRefreshToken(undefined)).not.toThrow();
  });

  it('should ignore missing refresh token cookie', () => {
    tokensServiceMock.getTokenFromCookies.mockReturnValue(null);

    expect(() => service.revokeRefreshToken('some-cookie')).not.toThrow();

    expect(tokensServiceMock.getTokenFromCookies).toHaveBeenCalledWith(
      'some-cookie',
      'refresh-token',
    );
  });

  it('should ignore invalid refresh token', () => {
    tokensServiceMock.getTokenFromCookies.mockReturnValue('bad-token');

    tokensServiceMock.validateRefreshTokenAndGetEmail.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    expect(() =>
      service.revokeRefreshToken('refresh-token=bad-token'),
    ).not.toThrow();
  });

  it('should revoke refresh token', async () => {
    const user = {
      id: 1,
      email: 'test@test.com',
      role: 'CLIENT',
    };

    jest.spyOn(service, 'getAuthenticatedUser').mockResolvedValue(user as any);

    tokensServiceMock.generateAccessToken.mockReturnValue('access');

    tokensServiceMock.generateRefreshToken.mockReturnValue('refresh');

    await service.login({
      email: 'test@test.com',
      password: 'password',
    });

    tokensServiceMock.getTokenFromCookies.mockReturnValue('refresh');

    tokensServiceMock.validateRefreshTokenAndGetEmail.mockReturnValue(
      'test@test.com',
    );

    service.revokeRefreshToken('refresh-token=refresh');

    await expect(
      service.refreshAccessToken('refresh-token=refresh'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

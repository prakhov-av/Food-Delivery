import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokensService } from './tokens.service';
import { User } from '../users/user.entity';

describe('TokensService', () => {
  let service: TokensService;

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'access-secret';
        case 'JWT_REFRESH_SECRET':
          return 'refresh-secret';
        default:
          throw new Error(`Unknown config key: ${key}`);
      }
    }),
  };

  const user: User = {
    id: 1,
    email: 'test@test.com',
  } as User;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token', () => {
      const token = service.generateAccessToken(user);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const token = service.generateRefreshToken(user);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('validateAccessTokenAndGetEmail', () => {
    it('should return email from valid access token', () => {
      const token = service.generateAccessToken(user);

      const email = service.validateAccessTokenAndGetEmail(token);

      expect(email).toBe(user.email);
    });

    it('should throw UnauthorizedException for invalid access token', () => {
      expect(() =>
        service.validateAccessTokenAndGetEmail('invalid-token'),
      ).toThrow();
    });
  });

  describe('validateRefreshTokenAndGetEmail', () => {
    it('should return email from valid refresh token', () => {
      const token = service.generateRefreshToken(user);

      const email = service.validateRefreshTokenAndGetEmail(token);

      expect(email).toBe(user.email);
    });

    it('should throw UnauthorizedException for invalid refresh token', () => {
      expect(() =>
        service.validateRefreshTokenAndGetEmail('invalid-token'),
      ).toThrow();
    });
  });

  describe('getTokenFromCookies', () => {
    it('should return null when cookies are undefined', () => {
      expect(
        service.getTokenFromCookies(undefined, 'refresh-token'),
      ).toBeNull();
    });

    it('should return null when requested cookie is absent', () => {
      expect(
        service.getTokenFromCookies('foo=1; bar=2', 'refresh-token'),
      ).toBeNull();
    });

    it('should return token from single cookie', () => {
      expect(
        service.getTokenFromCookies('refresh-token=abc123', 'refresh-token'),
      ).toBe('abc123');
    });

    it('should return token from multiple cookies', () => {
      expect(
        service.getTokenFromCookies(
          'foo=1; refresh-token=abc123; bar=2',
          'refresh-token',
        ),
      ).toBe('abc123');
    });

    it('should return null when cookie string is empty', () => {
      expect(service.getTokenFromCookies('', 'refresh-token')).toBeNull();
    });
  });
});

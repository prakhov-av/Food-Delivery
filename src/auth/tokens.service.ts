import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
   * Создаёт, извлекает и проверяет токены аутентификации, включая обработку cookie и проверку срока действия токена.
   */
@Injectable()
export class TokensService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.accessSecret = this.configService.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow('JWT_REFRESH_SECRET');
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  generateAccessToken(user: User): string {
    return jwt.sign({ email: user.email }, this.accessSecret, {
      expiresIn: '15m',
    });
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  generateRefreshToken(user: User): string {
    return jwt.sign({ email: user.email }, this.refreshSecret, {
      expiresIn: '12h',
    });
  }

  private validateTokenAndGetEmail(token: string, secret: string): string {
    let payload: string | JwtPayload;

    try {
      payload = jwt.verify(token, secret);
    } catch {
      throw new UnauthorizedException('Token is invalid');
    }

    if (
      payload !== null &&
      typeof payload === 'object' &&
      'email' in payload &&
      typeof payload.email === 'string'
    ) {
      return payload.email;
    }

    throw new UnauthorizedException('Token is invalid');
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  validateAccessTokenAndGetEmail(accessToken: string): string {
    return this.validateTokenAndGetEmail(accessToken, this.accessSecret);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  validateRefreshTokenAndGetEmail(refreshToken: string): string {
    return this.validateTokenAndGetEmail(refreshToken, this.refreshSecret);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  getTokenFromCookies(
    cookies: string | undefined,
    tokenTitle: string,
  ): string | null {
    if (cookies === undefined) {
      return null;
    }

    const cookiesList: string[] = cookies.split('; ');
    for (const cookie of cookiesList) {
      if (cookie.startsWith(`${tokenTitle}=`)) {
        return cookie.split('=', 2)[1];
      }
    }
    return null;
  }
}

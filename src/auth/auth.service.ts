import { Injectable, UnauthorizedException } from '@nestjs/common';

import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

import * as bcrypt from 'bcrypt';

import { TokensService } from './tokens.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { UserIsNotConfirmedException } from '../exceptions/types/user-is-not-confirmed.exception';

const INVALID_CREDENTIALS = 'Invalid email or password';

// Хэш-пустышка: сравнение выполняется всегда,
// чтобы время ответа не выдавало, существует ли такой email.
const DUMMY_HASH: string = bcrypt.hashSync('dummy-password', 10);

/**
   * Координирует сценарии входа, обновления токенов и выхода пользователя.
   */
@Injectable()
export class AuthService {
  private readonly refreshStorage: Map<string, string> = new Map<
    string,
    string
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
  ) {}

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAuthenticatedUser(
    username: string,
    password: string,
  ): Promise<User> {
    let user: User | null = null;

    try {
      user = await this.usersService.getConfirmedByEmail(username);
    } catch (error) {
      if (
        !(error instanceof EntityNotFoundException) &&
        !(error instanceof UserIsNotConfirmedException)
      ) {
        throw error;
      }
    }

    const isPasswordCorrect: boolean = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_HASH,
    );

    if (!user || !isPasswordCorrect) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return user;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async login(loginDto: LoginRequestDto): Promise<TokenResponseDto> {
    const user: User = await this.getAuthenticatedUser(
      loginDto.email,
      loginDto.password,
    );

    const accessToken: string = this.tokensService.generateAccessToken(user);

    const refreshToken: string = this.tokensService.generateRefreshToken(user);

    this.refreshStorage.set(user.email, refreshToken);

    const tokenDto: TokenResponseDto = new TokenResponseDto();

    tokenDto.accessToken = accessToken;
    tokenDto.refreshToken = refreshToken;
    tokenDto.userId = user.id;
    tokenDto.role = user.role;

    return tokenDto;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async refreshAccessToken(cookies: string | undefined): Promise<string> {
    if (cookies === undefined) {
      throw new UnauthorizedException(
        'Request does not contain cookie with refresh token',
      );
    }

    const refreshToken: string | null = this.tokensService.getTokenFromCookies(
      cookies,
      'refresh-token',
    );

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Request does not contain cookie with refresh token',
      );
    }

    const email: string =
      this.tokensService.validateRefreshTokenAndGetEmail(refreshToken);

    const savedRefreshToken: string | undefined =
      this.refreshStorage.get(email);

    if (refreshToken !== savedRefreshToken) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user: User = await this.usersService.getConfirmedByEmail(email);

    return this.tokensService.generateAccessToken(user);
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  revokeRefreshToken(cookies: string | undefined): void {
    if (cookies === undefined) {
      return;
    }

    const refreshToken: string | null = this.tokensService.getTokenFromCookies(
      cookies,
      'refresh-token',
    );

    if (!refreshToken) {
      return;
    }

    let email: string;

    try {
      email = this.tokensService.validateRefreshTokenAndGetEmail(refreshToken);
    } catch {
      return;
    }

    this.refreshStorage.delete(email);
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../types/auth.decorators';
import { TokensService } from '../tokens.service';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
   * Проверяет аутентификацию HTTP-запроса по access-токену из cookie, пропускает публичные маршруты и помещает подтверждённого пользователя в request.user.
   */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokensService: TokensService,
    private readonly usersService: UsersService,
  ) {}
/**
   * Определяет, разрешено ли выполнение HTTP-запроса. Публичные маршруты пропускаются без проверки; для остальных извлекается access-токен из cookie, проверяется его валидность и загружается подтверждённый пользователь.
   * @param context Контекст выполнения NestJS, содержащий HTTP-запрос и метаданные обработчика.
   * @returns true, если запрос разрешён.
   * @throws UnauthorizedException Если токен отсутствует, недействителен или пользователь не подтверждён.
   */

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request: AuthenticatedRequest = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const accessToken: string | null = this.tokensService.getTokenFromCookies(
      request.headers.cookie,
      'access-token',
    );

    if (!accessToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const email: string =
      this.tokensService.validateAccessTokenAndGetEmail(accessToken);
    request.user = await this.usersService.getConfirmedByEmail(email);

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokensService } from '../auth/tokens.service';
import { UsersService } from '../users/users.service';
import { GuestSessionsService } from '../guest-sessions/guest-sessions.service';
import { GUEST_SESSION_COOKIE } from '../guest-sessions/guest-session.constants';
import { ChatIdentityRequest } from './types/chat-identity-request';
import { ChatIdentity } from './types/chat-identity';
import { Role } from '../users/enums/role.enum';

/** Проверяет JWT зарегистрированного пользователя или гостевую cookie. */
@Injectable()
export class ChatIdentityGuard implements CanActivate {
  constructor(
    private readonly tokensService: TokensService,
    private readonly usersService: UsersService,
    private readonly guestSessionsService: GuestSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ChatIdentityRequest>();
    const accessToken = this.tokensService.getTokenFromCookies(
      request.headers.cookie,
      'access-token',
    );

    // Если access-token присутствует, но невалиден, не понижаем запрос до гостя.
    if (accessToken) {
      const email = this.tokensService.validateAccessTokenAndGetEmail(accessToken);
      const user = await this.usersService.getConfirmedByEmail(email);
      request.user = user;
      request.chatIdentity = { kind: 'user', userId: user.id, role: user.role };
      return true;
    }

    const guestToken = this.tokensService.getTokenFromCookies(
      request.headers.cookie,
      GUEST_SESSION_COOKIE,
    );

    if (!guestToken) {
      throw new UnauthorizedException('Authentication or guest session is required');
    }

    const guestSession = await this.guestSessionsService.resolveSession(guestToken);
    const identity: ChatIdentity = {
      kind: 'guest',
      guestSessionId: guestSession.id,
      role: Role.CUSTOMER,
    };
    request.chatIdentity = identity;
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum';
import { ROLES_KEY } from '../types/auth.decorators';
import { User } from '../../users/user.entity';

/**
   * Проверяет, соответствует ли роль аутентифицированного пользователя ролям, объявленным метаданными маршрута или контроллера.
   */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
/**
   * Проверяет наличие у пользователя роли, требуемой метаданными маршрута или контроллера. Если ограничения по ролям не заданы, проверка пропускает запрос; отсутствие аутентифицированного пользователя считается ошибкой авторизации.
   * @param context Контекст выполнения NestJS.
   * @returns true, если роли не ограничены или роль пользователя входит в разрешённый список; иначе false.
   * @throws UnauthorizedException Если в запросе отсутствует аутентифицированный пользователь.
   */

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles: Role[] = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request: any = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return requiredRoles.includes(user.role);
  }
}

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { TokensService } from './tokens.service';
import { AuthController } from './auth.controller';

@Module({
  providers: [AuthService, TokensService],
  exports: [AuthService, TokensService],
  imports: [UsersModule],
  controllers: [AuthController],
})
/**
   * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
   */
export class AuthModule {}

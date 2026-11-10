import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestSession } from './guest-session.entity';
import { GuestSessionsController } from './guest-sessions.controller';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestSessionGuard } from './guest-session.guard';

@Module({
  imports: [TypeOrmModule.forFeature([GuestSession])],
  controllers: [GuestSessionsController],
  providers: [GuestSessionsService, GuestSessionGuard],
  exports: [GuestSessionsService, GuestSessionGuard],
})
export class GuestSessionsModule {}

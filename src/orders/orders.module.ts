import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { GuestOrdersService } from './guest-orders.service';
import { Order } from './order.entity';
import { GuestSession } from '../guest-sessions/guest-session.entity';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { UsersModule } from '../users/users.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrdersValidator } from './validation/orders.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, GuestSession]),
    UsersModule,
    RestaurantsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    GuestOrdersService,
    OrdersRepository,
    OrdersMapper,
    OrdersValidator,
  ],
  exports: [OrdersService, GuestOrdersService],
})
/**
 * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
 */
export class OrdersModule {}

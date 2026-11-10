import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { GuestOrdersService } from './guest-orders.service';
import { GuestOrdersController } from './guest-orders.controller';
import { Order } from './order.entity';
import { GuestSession } from '../guest-sessions/guest-session.entity';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { UsersModule } from '../users/users.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrdersValidator } from './validation/orders.validator';
import { OrderItem } from '../order-items/order-item.entity';
import { OrderItemsRepository } from '../order-items/order-items.repository';
import { OrderItemsMapper } from '../order-items/dto/order-items.mapper';
import { MenuItemsModule } from '../menu-items/menu-items.module';
import { GuestSessionsModule } from '../guest-sessions/guest-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, GuestSession, OrderItem]),
    UsersModule,
    RestaurantsModule,
    MenuItemsModule,
    GuestSessionsModule,
  ],
  controllers: [OrdersController, GuestOrdersController],
  providers: [
    OrdersService,
    GuestOrdersService,
    OrdersRepository,
    OrdersMapper,
    OrdersValidator,
    OrderItemsRepository,
    OrderItemsMapper,
  ],
  exports: [OrdersService, GuestOrdersService],
})
/**
 * Объявляет модуль NestJS и связывает контроллеры, провайдеры и зависимости соответствующей функциональной области.
 */
export class OrdersModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { UsersModule } from '../users/users.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrdersValidator } from './validation/orders.validator';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), UsersModule, RestaurantsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersMapper, OrdersValidator],
  exports: [OrdersService],
})
export class OrdersModule {}

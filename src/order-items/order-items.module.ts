import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './order-item.entity';
import { OrderItemsController } from './order-items.controller';
import { OrderItemsService } from './order-items.service';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrdersModule } from '../orders/orders.module';
import { MenuItemsModule } from '../menu-items/menu-items.module';

@Module({
  controllers: [OrderItemsController],
  imports: [
    TypeOrmModule.forFeature([OrderItem]),
    OrdersModule,
    MenuItemsModule,
  ],
  providers: [OrderItemsService, OrderItemsRepository, OrderItemsMapper],
  exports: [OrderItemsService],
})
export class OrderItemsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './order-item.entity';
import { OrdersItemsController } from './order-items.controller';

@Module({
  controllers: [OrdersItemsController],
  imports: [TypeOrmModule.forFeature([OrderItem])],
})
export class OrderItemsModule {}

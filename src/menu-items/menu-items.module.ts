import { Module } from '@nestjs/common';
import { MenuItemsController } from './menu-items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './menu-item.entity';

@Module({
  controllers: [MenuItemsController],
  imports: [TypeOrmModule.forFeature([MenuItem])],
})
export class MenuItemsModule {}

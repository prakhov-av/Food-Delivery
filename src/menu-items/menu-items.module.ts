import { Module } from '@nestjs/common';
import { MenuItemsController } from './menu-items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './menu-item.entity';
import { MenuItemsRepository } from './menu-items.repository';
import { MenusModule } from '../menus/menus.module';
import { MenuItemsService } from './menu-items.service';
import { MenuItemsMapper } from './dto/menu-items.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem]), MenusModule],
  controllers: [MenuItemsController],
  providers: [MenuItemsService, MenuItemsRepository, MenuItemsMapper],
  exports: [MenuItemsService],
})
export class MenuItemsModule {}

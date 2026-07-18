import { Module } from '@nestjs/common';
import { MenuItemsController } from './menu-items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './menu-item.entity';
import { MenuItemsRepository } from './menu-items.repository';
import { MenusModule } from '../menus/menus.module';
import { MenuItemsService } from './menu-items.service';
import { MenuItemsMapper } from './dto/menu-items.mapper';
import { MenuItemsValidator } from './validation/menu-items.validator';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem]), MenusModule],
  controllers: [MenuItemsController],
  providers: [
    MenuItemsService,
    MenuItemsRepository,
    MenuItemsMapper,
    MenuItemsValidator,
  ],
  exports: [MenuItemsService, MenuItemsMapper],
})
export class MenuItemsModule {}

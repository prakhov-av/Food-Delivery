import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Menu } from './menu.entity';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { MenusRepository } from './menus.repository';
import { MenusMapper } from './dto/menus.mapper';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { MenusValidator } from './validation/menus.validator';

@Module({
  imports: [TypeOrmModule.forFeature([Menu]), RestaurantsModule],
  controllers: [MenusController],
  providers: [MenusService, MenusRepository, MenusMapper, MenusValidator],
  exports: [MenusService],
})
export class MenusModule {}

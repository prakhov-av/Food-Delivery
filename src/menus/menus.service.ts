import { Injectable } from '@nestjs/common';
import { MenusRepository } from './menus.repository';
import { MenusMapper } from './dto/menus.mapper';
import { MenuSaveDto } from './dto/menu.save-dto';
import { MenuDto } from './dto/menu.dto';
import { Menu } from './menu.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { Restaurant } from '../restaurants/restaurant.entity';
import { MenuUpdateDto } from './dto/menu.update-dto';
import { MenusValidator } from './validation/menus.validator';

@Injectable()
export class MenusService {
  constructor(
    private readonly repository: MenusRepository,
    private readonly mapper: MenusMapper,
    private readonly restaurantsService: RestaurantsService,
    private readonly validator: MenusValidator,
  ) {}

  async create(saveDto: MenuSaveDto): Promise<MenuDto> {
    this.validator.validateSaveDto(saveDto);
    const entity: Menu = this.mapper.mapDtoToEntity(saveDto);
    const restaurant: Restaurant =
      await this.restaurantsService.getActiveEntityById(saveDto.restaurantId);

    entity.restaurant = restaurant;
    entity.active = true;
    await this.repository.save(entity);
    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveMenus(): Promise<MenuDto[]> {
    const menus: Menu[] = await this.repository.findAllActive();
    return this.mapper.mapEntityListToDtoList(menus);
  }

  async getActiveMenuById(id: number): Promise<MenuDto> {
    const menu: Menu = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(menu);
  }

  async getActiveEntityById(id: number): Promise<Menu> {
    const menu: Menu | null = await this.repository.findById(id);

    if (!menu || !menu.active) {
      throw Error('Menu not found');
    }

    return menu;
  }

  async update(id: number, updateDto: MenuUpdateDto): Promise<void> {
    this.validator.validateUpdateDto(updateDto);
    const foundMenu: Menu | null = await this.repository.findById(id);

    if (foundMenu) {
      foundMenu.name = updateDto.newName;
      await this.repository.save(foundMenu);
    }
  }

  async deleteById(id: number): Promise<void> {
    const menu: Menu = await this.getActiveEntityById(id);
    menu.active = false;
    await this.repository.save(menu);
  }

  async restoreById(id: number): Promise<void> {
    const menu: Menu | null = await this.repository.findById(id);

    if (menu && !menu.active) {
      menu.active = true;
      await this.repository.save(menu);
    }
  }
}

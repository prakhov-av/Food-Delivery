import { Injectable, Logger } from '@nestjs/common';
import { MenuItemsRepository } from './menu-items.repository';
import { MenuItemsMapper } from './dto/menu-items.mapper';
import { MenuItemSaveDto } from './dto/menu-item.save-dto';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuItem } from './menu-item.entity';
import { MenuItemUpdateDto } from './dto/menu-item.update-dto';
import { MenusService } from '../menus/menus.service';
import { Menu } from '../menus/menu.entity';
import { MenuItemsValidator } from './validation/menu-items.validator';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

@Injectable()
export class MenuItemsService {
  private readonly logger: Logger = new Logger(MenuItemsService.name);

  constructor(
    private readonly repository: MenuItemsRepository,
    private readonly mapper: MenuItemsMapper,
    private readonly menusService: MenusService,
    private readonly validator: MenuItemsValidator,
  ) {}

  async create(saveDto: MenuItemSaveDto): Promise<MenuItemDto> {
    this.validator.validateSaveDto(saveDto);
    const entity: MenuItem = this.mapper.mapDtoToEntity(saveDto);
    const menu: Menu = await this.menusService.getActiveEntityById(
      saveDto.menuId,
    );
    entity.menu = menu;
    entity.active = true;
    await this.repository.save(entity);

    this.logger.log(
      `Menu item created: id ${entity.id}, menu ${entity.menu.id}`,
    );
    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveMenuItems(): Promise<MenuItemDto[]> {
    const menuItems: MenuItem[] = await this.repository.findAllActive();

    if (menuItems.length === 0) {
      throw new EntityNotFoundException(MenuItem.name);
    }

    return this.mapper.mapEntityListToDtoList(menuItems);
  }

  async getActiveMenuItemById(id: number): Promise<MenuItemDto> {
    const menuItem: MenuItem = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(menuItem);
  }

  async getActiveEntityById(id: number): Promise<MenuItem> {
    const menuItem: MenuItem | null = await this.repository.findById(id);

    if (!menuItem || !menuItem.active) {
      throw new EntityNotFoundException(MenuItem.name, id);
    }

    return menuItem;
  }

  async update(id: number, updateItemDto: MenuItemUpdateDto): Promise<void> {
    this.validator.validateUpdateDto(updateItemDto);
    const foundMenuItem: MenuItem = await this.getActiveEntityById(id);

    foundMenuItem.name = updateItemDto.newName;
    foundMenuItem.description = updateItemDto.newDescription;
    foundMenuItem.price = updateItemDto.newPrice;
    await this.repository.save(foundMenuItem);

    this.logger.log(
      `Menu item updated: id ${id}, new name ${foundMenuItem.name}, new description ${foundMenuItem.description}, new price ${foundMenuItem.price}`,
    );
  }

  async deleteById(id: number): Promise<void> {
    const menuItem: MenuItem = await this.getActiveEntityById(id);
    menuItem.active = false;
    await this.repository.save(menuItem);
    this.logger.log(`Menu item marked as inactive: id ${id}`);
  }

  async restoreById(id: number): Promise<void> {
    const menuItem: MenuItem | null = await this.repository.findById(id);

    if (!menuItem) {
      throw new EntityNotFoundException(MenuItem.name, id);
    }

    if (!menuItem.active) {
      menuItem.active = true;
      await this.repository.save(menuItem);
      this.logger.log(`Menu item marked as active: id ${id}`);
    }
  }
}

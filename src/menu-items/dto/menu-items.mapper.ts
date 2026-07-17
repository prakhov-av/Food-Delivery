import { Injectable } from '@nestjs/common';
import { MenuItemSaveDto } from './menu-item.save-dto';
import { MenuItem } from '../menu-item.entity';
import { MenuItemDto } from './menu-item.dto';

@Injectable()
export class MenuItemsMapper {
  mapEntityToDto(entity: MenuItem): MenuItemDto {
    if (!entity) {
      return new MenuItemDto();
    }

    const dto: MenuItemDto = new MenuItemDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.price = entity.price;
    return dto;
  }

  mapDtoToEntity(saveDto: MenuItemSaveDto): MenuItem {
    const entity: MenuItem = new MenuItem();
    entity.name = saveDto.name;
    entity.description = saveDto.description;
    entity.price = saveDto.price;
    return entity;
  }

  mapEntityListToDtoList(entityList: MenuItem[]): MenuItemDto[] {
    return entityList.map((m: MenuItem): MenuItemDto => this.mapEntityToDto(m));
  }
}

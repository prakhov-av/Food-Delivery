import { Injectable } from '@nestjs/common';
import { Menu } from '../menu.entity';
import { MenuDto } from './menu.dto';
import { MenuSaveDto } from './menu.save-dto';

@Injectable()
export class MenusMapper {
  mapEntityToDto(entity: Menu): MenuDto {
    const dto: MenuDto = new MenuDto();
    dto.id = entity.id;
    dto.name = entity.name;
    return dto;
  }

  mapDtoToEntity(saveDto: MenuSaveDto): Menu {
    const entity: Menu = new Menu();
    entity.name = saveDto.name;
    return entity;
  }

  mapEntityListToDtoList(entityList: Menu[]): MenuDto[] {
    return entityList.map((m: Menu): MenuDto => this.mapEntityToDto(m));
  }
}

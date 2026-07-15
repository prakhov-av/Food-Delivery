import { Injectable } from '@nestjs/common';
import { Restaurant } from '../restaurant.entity';
import { RestaurantDto } from './restaurant.dto';
import { RestaurantSaveDto } from './restaurant.save-dto';

@Injectable()
export class RestaurantsMapper {
  mapEntityToDto(entity: Restaurant): RestaurantDto {
    const dto: RestaurantDto = new RestaurantDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.address = entity.address;
    dto.phone = entity.phone;
    dto.email = entity.email;
    return dto;
  }

  mapDtoToEntity(saveDto: RestaurantSaveDto): Restaurant {
    const entity: Restaurant = new Restaurant();
    entity.name = saveDto.name;
    entity.address = saveDto.address;
    entity.phone = saveDto.phone;
    entity.email = saveDto.email;
    return entity;
  }

  mapEntityListToDtoList(entityList: Restaurant[]): RestaurantDto[] {
    return entityList.map((r: Restaurant): RestaurantDto =>
      this.mapEntityToDto(r),
    );
  }
}

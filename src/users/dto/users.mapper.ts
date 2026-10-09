import { Injectable } from '@nestjs/common';
import { User } from '../user.entity';
import { UserDto } from './user.dto';
import { UserSaveDto } from './user.save-dto';

/**
   * Описывает структуру данных «UsersMapper», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
@Injectable()
export class UsersMapper {
  mapEntityToDto(entity: User): UserDto {
    if (!entity) {
      return new UserDto();
    }

    const dto: UserDto = new UserDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.role = entity.role;
    return dto;
  }

  mapDtoToEntity(saveDto: UserSaveDto): User {
    const entity: User = new User();
    entity.email = saveDto.email;
    entity.password = saveDto.password;
    entity.name = saveDto.name;
    entity.phone = saveDto.phone;
    return entity;
  }

  mapEntityListToDtoList(entityList: User[]): UserDto[] {
    return entityList.map((u: User): UserDto => this.mapEntityToDto(u));
  }
}

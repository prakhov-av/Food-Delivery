import { Role } from '../enums/role.enum';
import { ApiProperty } from '@nestjs/swagger';

/**
   * Описывает структуру данных «UserDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class UserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: Role;

  @ApiProperty()
  phone: string;
}

import { ApiProperty } from '@nestjs/swagger';

/**
   * Описывает структуру данных «RestaurantDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class RestaurantDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;
}

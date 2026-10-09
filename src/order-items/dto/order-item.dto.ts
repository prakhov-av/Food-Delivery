import { ApiProperty } from '@nestjs/swagger';
import { MenuItemDto } from '../../menu-items/dto/menu-item.dto';

/**
   * Описывает структуру данных «OrderItemDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class OrderItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  menuItem: MenuItemDto;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  orderId: number;
}

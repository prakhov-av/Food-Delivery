import { ApiProperty } from '@nestjs/swagger';
import { MenuItemDto } from '../../menu-items/dto/menu-item.dto';

export class OrderItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  menuItem: MenuItemDto;

  @ApiProperty()
  quantity: number;
}

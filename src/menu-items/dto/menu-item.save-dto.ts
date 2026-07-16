import { ApiProperty } from '@nestjs/swagger';

export class MenuItemSaveDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  menuId: number;
}

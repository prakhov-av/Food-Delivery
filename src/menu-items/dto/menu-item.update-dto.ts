import { ApiProperty } from '@nestjs/swagger';

export class MenuItemUpdateDto {
  @ApiProperty()
  newName: string;

  @ApiProperty()
  newDescription: string;

  @ApiProperty()
  newPrice: number;
}

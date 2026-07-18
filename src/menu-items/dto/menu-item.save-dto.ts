import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches, Min } from 'class-validator';

export class MenuItemSaveDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  name: string;

  @ApiProperty()
  @Length(2, 200)
  description: string;

  @ApiProperty()
  @Min(0.01)
  price: number;

  @ApiProperty()
  @Min(1)
  menuId: number;
}

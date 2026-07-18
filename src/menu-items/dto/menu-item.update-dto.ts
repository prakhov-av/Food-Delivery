import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches, Min } from 'class-validator';

export class MenuItemUpdateDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  newName: string;

  @ApiProperty()
  @Length(2, 200)
  newDescription: string;

  @ApiProperty()
  @Min(0.01)
  newPrice: number;
}

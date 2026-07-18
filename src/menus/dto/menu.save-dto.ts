import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches, Min } from 'class-validator';

export class MenuSaveDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  name: string;

  @ApiProperty()
  @Min(1)
  restaurantId: number;
}

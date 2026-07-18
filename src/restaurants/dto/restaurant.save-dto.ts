import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Length, Matches } from 'class-validator';

export class RestaurantSaveDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  name: string;

  @ApiProperty()
  @Length(5, 100)
  address: string;

  @ApiProperty()
  @Matches(/^\+?[0-9\s\-()]{7,18}$/, {
    message: 'Invalid phone number',
  })
  phone: string;

  @ApiProperty()
  @IsEmail()
  email: string;
}

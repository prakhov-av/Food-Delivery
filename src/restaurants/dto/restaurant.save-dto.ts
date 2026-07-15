import { ApiProperty } from '@nestjs/swagger';

export class RestaurantSaveDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;
}

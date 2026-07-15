import { ApiProperty } from '@nestjs/swagger';

export class RestaurantUpdateDto {
  @ApiProperty()
  newName: string;
}

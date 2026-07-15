import { ApiProperty } from '@nestjs/swagger';

export class MenuSaveDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  restaurantId: number;
}

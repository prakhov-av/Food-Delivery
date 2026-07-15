import { ApiProperty } from '@nestjs/swagger';

export class MenuDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

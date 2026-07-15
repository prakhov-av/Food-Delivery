import { ApiProperty } from '@nestjs/swagger';

export class MenuUpdateDto {
  @ApiProperty()
  newName: string;
}

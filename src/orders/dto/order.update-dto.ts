import { ApiProperty } from '@nestjs/swagger';
import { Status } from '../enums/status.enum';

export class OrderUpdateDto {
  @ApiProperty({
    enum: Status,
  })
  status: Status;

  @ApiProperty({ required: false })
  courierId?: number;
}

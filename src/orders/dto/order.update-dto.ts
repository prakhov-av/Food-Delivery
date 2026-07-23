import { ApiProperty } from '@nestjs/swagger';
//import { Status } from '../enums/status.enum';
import { Min } from 'class-validator';

export class OrderUpdateDto {
  // @ApiProperty({ enum: Status })
  // @IsEnum(Status)
  // status: Status;

  @ApiProperty({ required: false })
  @Min(1)
  courierId?: number;
}

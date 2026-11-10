import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Status } from '../enums/status.enum';

/**
 * Запрос на смену статуса заказа гостем.
 */
export class GuestOrderStatusDto {
  @ApiProperty({ enum: Status })
  @IsEnum(Status)
  status: Status;
}

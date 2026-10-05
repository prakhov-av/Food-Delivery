import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class OrderUpdateDto {
  @ApiProperty({
    required: false,
    description: 'ID курьера для ручного назначения или замены',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  courierId?: number;
}

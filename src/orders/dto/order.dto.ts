import { ApiProperty } from '@nestjs/swagger';
import { Status } from '../enums/status.enum';
import { UserDto } from '../../users/dto/user.dto';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';
import { IsEnum } from 'class-validator';

export class OrderDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  customer: UserDto;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  courier: UserDto | null;

  @ApiProperty()
  restaurant: RestaurantDto;

  @ApiProperty({ enum: Status, required: false })
  @IsEnum(Status)
  status?: Status;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  createdAt: Date;
}

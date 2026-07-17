import { ApiProperty } from '@nestjs/swagger';
import { Status } from '../enums/status.enum';
import { UserDto } from '../../users/dto/user.dto';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

export class OrderDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  customer: UserDto;

  @ApiProperty()
  courier: UserDto;

  @ApiProperty()
  restaurant: RestaurantDto;

  @ApiProperty()
  status: Status;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  createdAt: Date;
}

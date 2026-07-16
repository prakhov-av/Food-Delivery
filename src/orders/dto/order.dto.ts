import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/user.entity';
import { Restaurant } from '../../restaurants/restaurant.entity';
import { Status } from '../enums/status.enum';

export class OrderDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  customer: User;

  @ApiProperty()
  courier: User;

  @ApiProperty()
  restaurant: Restaurant;

  @ApiProperty()
  status: Status;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  createdAt: Date;
}

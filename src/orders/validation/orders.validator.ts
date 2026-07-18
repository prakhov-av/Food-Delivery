import { Injectable } from '@nestjs/common';
import { OrderSaveDto } from '../dto/order.save-dto';
import { OrderUpdateDto } from '../dto/order.update-dto';
import { Status } from '../enums/status.enum';

@Injectable()
export class OrdersValidator {
  validateSaveDto(saveDto: OrderSaveDto): void {
    if (!saveDto) {
      throw Error();
    }

    const customerId: number = saveDto.customerId;
    if (!customerId || customerId < 1) {
      throw Error();
    }

    const restaurantId: number = saveDto.restaurantId;
    if (!restaurantId || restaurantId < 1) {
      throw Error();
    }
  }

  validateUpdateDto(updateDto: OrderUpdateDto): void {
    if (!updateDto) {
      throw Error();
    }

    if (!Object.values(Status).includes(updateDto.status)) {
      throw Error();
    }

    if (updateDto.courierId && updateDto.courierId < 1) {
      throw Error();
    }

    if (updateDto.courierId !== undefined && updateDto.courierId < 1) {
      throw Error();
    }
  }
}

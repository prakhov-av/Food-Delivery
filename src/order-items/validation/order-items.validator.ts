import { Injectable } from '@nestjs/common';
import { OrderItemSaveDto } from '../dto/order-item.save-dto';
import { OrderItemUpdateDto } from '../dto/order-item.update-dto';

@Injectable()
export class OrderItemsValidator {
  validateSaveDto(saveDto: OrderItemSaveDto): void {
    if (!saveDto) {
      throw Error();
    }

    const orderId: number = saveDto.orderId;
    if (!orderId || orderId < 1) {
      throw Error();
    }

    const menuItemId: number = saveDto.menuItemId;
    if (!menuItemId || menuItemId < 1) {
      throw Error();
    }

    const quantity: number = saveDto.quantity;
    if (!quantity || quantity < 1) {
      throw Error();
    }
  }

  validateUpdateDto(updateDto: OrderItemUpdateDto): void {
    if (!updateDto) {
      throw Error();
    }

    if (updateDto.newQuantity !== undefined && updateDto.newQuantity < 1) {
      throw Error();
    }
  }
}

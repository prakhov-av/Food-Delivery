import { Injectable } from '@nestjs/common';

import { RestaurantSaveDto } from '../dto/restaurant.save-dto';
import { RestaurantUpdateDto } from '../dto/restaurant.update-dto';

@Injectable()
export class RestaurantsValidator {
  validateSaveDto(saveDto: RestaurantSaveDto): void {
    if (!saveDto) {
      throw Error();
    }

    const email: string = saveDto.email.trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw Error();
    }

    const name: string = saveDto.name.trim();
    if (!name || name.length < 2 || name.length > 50) {
      throw Error();
    }

    const address = saveDto.address.trim();

    if (!address || address.length < 5 || address.length > 100) {
      throw Error();
    }
  }

  validateUpdateDto(updateDto: RestaurantUpdateDto): void {
    if (!updateDto) {
      throw Error();
    }

    const name: string = updateDto.newName.trim();
    if (!name || name.length < 2 || name.length > 30) {
      throw Error();
    }
  }
}
